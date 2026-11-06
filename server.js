#!/usr/bin/env node
/*
 * Meeqat — Prayer Time Display Server
 * Zero-dependency Node.js server (Node 16+).
 *  - Works OFFLINE on local Wi-Fi (Raspberry Pi / PC / Android-Termux in the masjid)
 *  - Works ONLINE on any cloud host (Render, Railway, VPS, Docker)
 *  - Serves the TV display (/), mobile control panel (/admin), settings API,
 *    live push to TVs (Server-Sent Events) and uploaded adhan audio.
 *  - Multi-screen: one server can run many masjids/homes, each with its own ID + PIN.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const VERSION = '1.1.0';
const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const SCREENS = path.join(DATA, 'screens');
const MEDIA = path.join(DATA, 'media');
// ALLOW_NEW_SCREENS: 'admins' (default) = only a logged-in admin of an existing screen can create more,
//                    '1' = anyone can create a screen, '0' = disabled.
const ALLOW_NEW = (process.env.ALLOW_NEW_SCREENS || 'admins').toLowerCase();
const ON_CLOUD = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.FLY_APP_NAME || process.env.CLOUD);
// On a public cloud host never fall back to 1234: use DEFAULT_PIN or a random one printed in the logs.
const DEFAULT_PIN = process.env.DEFAULT_PIN || (ON_CLOUD ? String(crypto.randomInt(100000, 999999)) : '1234');
// ALLOWED_ORIGINS: comma list of sites allowed to call the API from a browser (e.g. https://miqat.netlify.app). Default: any.
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*').split(',').map((x) => x.trim().replace(/\/+$/, '')).filter(Boolean);
const MAX_SETTINGS = 512 * 1024;      // 512 KB of JSON
const MAX_AUDIO = 15 * 1024 * 1024;   // 15 MB per audio file
const MEDIA_NAMES = ['adhan', 'adhan-fajr', 'iqamah'];

for (const d of [DATA, SCREENS, MEDIA]) fs.mkdirSync(d, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm'
};
const AUDIO_EXT = { 'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/webm': '.webm' };
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/* ---------- PIN hashing ---------- */
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function checkPin(pin, stored) {
  if (!pin || !stored) return false;
  const [salt, h] = stored.split(':');
  const a = crypto.scryptSync(String(pin), salt, 32);
  const b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const validPin = (p) => /^\d{4,12}$/.test(String(p || ''));

/* ---------- Screen storage ---------- */
const cache = new Map();
function screenFile(id) { return path.join(SCREENS, id + '.json'); }
function load(id) {
  if (!ID_RE.test(id)) return null;
  if (cache.has(id)) return cache.get(id);
  const f = screenFile(id);
  if (!fs.existsSync(f)) return null;
  try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); cache.set(id, d); return d; }
  catch (e) { console.error('Corrupt screen file', f, e.message); return null; }
}
function save(id, d) {
  cache.set(id, d);
  const f = screenFile(id), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 1));
  fs.renameSync(tmp, f);
}
function findMedia(id, name) {
  const dir = path.join(MEDIA, id);
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((x) => x.startsWith(name + '.'));
  return f ? path.join(dir, f) : null;
}
function mediaMeta(id) {
  const out = {};
  for (const n of MEDIA_NAMES) {
    const f = findMedia(id, n);
    out[n] = f ? { size: fs.statSync(f).size, v: Math.floor(fs.statSync(f).mtimeMs) } : null;
  }
  return out;
}
if (!load('main')) {
  save('main', { id: 'main', name: 'Main screen', pin: hashPin(DEFAULT_PIN), pinIsDefault: true, firstPin: process.env.DEFAULT_PIN ? undefined : DEFAULT_PIN, settings: null, rev: 0, created: Date.now(), updated: Date.now() });
}

/* ---------- Live push (Server-Sent Events) ---------- */
const clients = new Map(); // id -> Set<res>
function broadcast(id, event, data) {
  const set = clients.get(id);
  if (!set) return 0;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`;
  for (const res of set) { try { res.write(msg); } catch (e) { /* ignore */ } }
  return set.size;
}
setInterval(() => {
  for (const set of clients.values()) for (const res of set) { try { res.write(': ping\n\n'); } catch (e) { /* ignore */ } }
}, 25000);

/* ---------- Brute-force protection ---------- */
const fails = new Map();
function ipOf(req) { return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'; }
function locked(req) { const f = fails.get(ipOf(req)); return f && f.until > Date.now(); }
function noteFail(req) {
  const ip = ipOf(req), f = fails.get(ip) || { n: 0, until: 0 };
  f.n++; if (f.n >= 8) { f.until = Date.now() + 5 * 60 * 1000; f.n = 0; }
  fails.set(ip, f);
}
function noteOk(req) { fails.delete(ipOf(req)); }

/* ---------- Helpers ---------- */
function corsOrigin(req) {
  const o = req && req.headers.origin;
  if (ALLOWED.includes('*')) return '*';
  return o && ALLOWED.includes(o) ? o : ALLOWED[0];
}
let curReq = null;
function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': corsOrigin(res.req || curReq), 'Vary': 'Origin' }, headers || {}));
  res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj), { 'Content-Type': MIME['.json'] }); }
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit) {
  const b = await readBody(req, limit || 64 * 1024);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch (e) { throw Object.assign(new Error('Bad JSON'), { code: 400 }); }
}
function auth(req, res, scr) {
  if (locked(req)) { json(res, 429, { error: 'Too many wrong PINs. Try again in 5 minutes.' }); return false; }
  if (!checkPin(req.headers['x-pin'], scr.pin)) { noteFail(req); json(res, 401, { error: 'Wrong PIN' }); return false; }
  noteOk(req); return true;
}
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
    if ((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push(a.address);
  }
  return out;
}
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'screen'; }
function publicScreen(id, s) {
  return { id, name: s.name, rev: s.rev, updated: s.updated, settings: s.settings, pinIsDefault: !!s.pinIsDefault, media: mediaMeta(id) };
}

/* ---------- Static files ---------- */
function serveStatic(req, res, urlPath) {
  let p = urlPath;
  if (p === '/' || p === '/tv' || p === '/display') p = '/index.html';
  else if (p === '/admin' || p === '/admin/' || p === '/control') p = '/admin.html';
  const file = path.normalize(path.join(PUB, decodeURIComponent(p)));
  if (!file.startsWith(PUB)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const ext = path.extname(file).toLowerCase();
    const longCache = ext === '.woff2' || ext === '.woff' || file.includes(path.sep + 'vendor' + path.sep);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': longCache ? 'public, max-age=2592000' : 'no-cache'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function serveMedia(req, res, id, name) {
  const f = findMedia(id, name);
  if (!f) return send(res, 404, 'Not found');
  const st = fs.statSync(f), ext = path.extname(f), type = MIME[ext] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
    res.writeHead(206, { 'Access-Control-Allow-Origin': corsOrigin(req), 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'public, max-age=86400' });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Access-Control-Allow-Origin': corsOrigin(req), 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
  fs.createReadStream(f).pipe(res);
}

/* ---------- Router ---------- */
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (req.method === 'OPTIONS') {
    return send(res, 204, '', { 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Pin,X-Screen', 'Access-Control-Max-Age': '86400' });
  }

  if (p === '/api/info' || p === '/healthz') return json(res, 200, { app: 'Miqat', version: VERSION, now: Date.now(), port: PORT, lan: ON_CLOUD ? [] : lanAddresses(), allowNew: ALLOW_NEW });
  if (p === '/api/time') return json(res, 200, { now: Date.now() });

  if (p === '/api/screens' && req.method === 'POST') {
    if (ALLOW_NEW === '0') return json(res, 403, { error: 'Creating new screens is disabled on this server.' });
    if (ALLOW_NEW !== '1') {
      const owner = load(String(req.headers['x-screen'] || ''));
      if (locked(req)) return json(res, 429, { error: 'Too many wrong PINs. Try again in 5 minutes.' });
      if (!owner || !checkPin(req.headers['x-pin'], owner.pin)) { noteFail(req); return json(res, 401, { error: 'Log in as an admin of an existing screen to create a new one.' }); }
    }
    const b = await readJson(req);
    if (!validPin(b.pin)) return json(res, 400, { error: 'PIN must be 4–12 digits.' });
    let id; do { id = slug(b.name) + '-' + crypto.randomBytes(2).toString('hex'); } while (load(id));
    const scr = { id, name: String(b.name || 'New screen').slice(0, 80), pin: hashPin(b.pin), pinIsDefault: false, settings: b.settings || null, rev: 1, created: Date.now(), updated: Date.now() };
    save(id, scr);
    return json(res, 201, { ok: true, id });
  }

  let m = /^\/media\/([a-z0-9-]+)\/([a-z-]+)$/.exec(p);
  if (m && (req.method === 'GET' || req.method === 'HEAD')) return serveMedia(req, res, m[1], m[2]);

  m = /^\/api\/screens\/([a-z0-9-]+)(?:\/([a-z]+))?(?:\/([a-z-]+))?$/.exec(p);
  if (m) {
    const [, id, action, sub] = m;
    const scr = load(id);
    if (!scr) return json(res, 404, { error: 'Screen not found: ' + id });

    if (!action && req.method === 'GET') return json(res, 200, publicScreen(id, scr));

    if (action === 'events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': corsOrigin(req), 'Vary': 'Origin' });
      res.write(`retry: 5000\nevent: hello\ndata: ${JSON.stringify({ rev: scr.rev, now: Date.now() })}\n\n`);
      if (!clients.has(id)) clients.set(id, new Set());
      clients.get(id).add(res);
      req.on('close', () => { const s = clients.get(id); if (s) s.delete(res); });
      return;
    }

    if (action === 'login' && req.method === 'POST') {
      if (locked(req)) return json(res, 429, { error: 'Too many wrong PINs. Try again in 5 minutes.' });
      const b = await readJson(req);
      if (!checkPin(b.pin, scr.pin)) { noteFail(req); return json(res, 401, { error: 'Wrong PIN' }); }
      noteOk(req);
      return json(res, 200, Object.assign({ ok: true, viewers: (clients.get(id) || new Set()).size }, publicScreen(id, scr)));
    }

    if (action === 'settings' && req.method === 'PUT') {
      if (!auth(req, res, scr)) return;
      const b = await readJson(req, MAX_SETTINGS);
      if (!b || typeof b.settings !== 'object') return json(res, 400, { error: 'Missing settings' });
      scr.settings = b.settings;
      if (b.name) scr.name = String(b.name).slice(0, 80);
      scr.rev = (scr.rev || 0) + 1; scr.updated = Date.now();
      save(id, scr);
      const viewers = broadcast(id, 'settings', { rev: scr.rev });
      return json(res, 200, { ok: true, rev: scr.rev, viewers });
    }

    if (action === 'pin' && req.method === 'POST') {
      if (!auth(req, res, scr)) return;
      const b = await readJson(req);
      if (!validPin(b.newPin)) return json(res, 400, { error: 'PIN must be 4–12 digits.' });
      scr.pin = hashPin(b.newPin); scr.pinIsDefault = false; delete scr.firstPin; save(id, scr);
      return json(res, 200, { ok: true });
    }

    if (action === 'command' && req.method === 'POST') {
      if (!auth(req, res, scr)) return;
      const b = await readJson(req);
      const allowed = ['reload', 'test-adhan', 'test-iqamah', 'test-salah', 'identify', 'stop'];
      if (!allowed.includes(b.type)) return json(res, 400, { error: 'Unknown command' });
      const viewers = broadcast(id, 'command', { type: b.type, prayer: b.prayer || 'dhuhr', at: Date.now() });
      return json(res, 200, { ok: true, viewers });
    }

    if (action === 'media' && sub && MEDIA_NAMES.includes(sub)) {
      if (!auth(req, res, scr)) return;
      const dir = path.join(MEDIA, id);
      fs.mkdirSync(dir, { recursive: true });
      const old = findMedia(id, sub);
      if (req.method === 'DELETE') {
        if (old) fs.unlinkSync(old);
        broadcast(id, 'settings', { rev: scr.rev, media: true });
        return json(res, 200, { ok: true });
      }
      if (req.method === 'PUT') {
        const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const ext = AUDIO_EXT[type];
        if (!ext) return json(res, 415, { error: 'Please upload an MP3, M4A, AAC, OGG or WAV file.' });
        const buf = await readBody(req, MAX_AUDIO);
        if (!buf.length) return json(res, 400, { error: 'Empty file' });
        if (old) fs.unlinkSync(old);
        fs.writeFileSync(path.join(dir, sub + ext), buf);
        broadcast(id, 'settings', { rev: scr.rev, media: true });
        return json(res, 200, { ok: true, media: mediaMeta(id) });
      }
    }
    return json(res, 405, { error: 'Not allowed' });
  }

  if (p.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  return serveStatic(req, res, p);
}

const server = http.createServer((req, res) => {
  curReq = req;
  handle(req, res).catch((e) => {
    if (!res.headersSent) json(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Server error' });
    if (!e.code) console.error(e);
  });
});
server.keepAliveTimeout = 65000;
server.listen(PORT, HOST, () => {
  const ips = lanAddresses();
  const line = '─'.repeat(58);
  console.log(`\n${line}\n  Meeqat Prayer Display v${VERSION} is running\n${line}`);
  console.log(`  TV display  : http://localhost:${PORT}/`);
  for (const ip of ips) console.log(`  On Wi-Fi    : http://${ip}:${PORT}/        (open on the TV)`);
  for (const ip of ips) console.log(`  Phone admin : http://${ip}:${PORT}/admin   (open on your phone)`);
  const main = load('main');
  if (main && main.pinIsDefault) console.log(`\n  PIN for screen "main" is ${main.firstPin || DEFAULT_PIN} — change it in Admin › Settings.`);
  if (ON_CLOUD && !process.env.DATA_DIR) console.log('  WARNING: DATA_DIR is not set — attach a volume (e.g. /data) or settings are lost on redeploy.');
  console.log(`  Data folder : ${DATA}\n${line}\n`);
});

function shutdown() { console.log('Shutting down…'); for (const set of clients.values()) for (const r of set) { try { r.end(); } catch (e) { /* */ } } server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
