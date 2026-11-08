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

const VERSION = '1.7.5';
const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const SCREENS = path.join(DATA, 'screens');
const MEDIA = path.join(DATA, 'media');
const LIBRARY = path.join(DATA, 'library');          // administrator's adhan library (super admin uploads)
// ALLOW_NEW_SCREENS: 'admins' (default) = only a logged-in admin of an existing screen can create more,
//                    '1' = anyone can create a screen, '0' = disabled.
const ALLOW_NEW = (process.env.ALLOW_NEW_SCREENS || 'admins').toLowerCase();
const ON_CLOUD = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.FLY_APP_NAME || process.env.CLOUD);
// On a public cloud host never fall back to 1234: use DEFAULT_PIN or a random one printed in the logs.
const DEFAULT_PIN = process.env.DEFAULT_PIN || (ON_CLOUD ? String(crypto.randomInt(100000, 999999)) : '1234');
// ALLOWED_ORIGINS: comma list of sites allowed to call the API from a browser (e.g. https://miqat.netlify.app). Default: any.
// Public self-registration: 'open' (default) = new screens work at once, 'approval' = wait for super admin, 'closed' = off.
const REGISTRATION = (process.env.REGISTRATION || 'open').toLowerCase();
// Super-admin dashboard (/super) is enabled only when SUPER_ADMIN_PASSWORD is set (min 8 chars).
const SUPER_PASS = String(process.env.SUPER_ADMIN_PASSWORD || '').length >= 8 ? String(process.env.SUPER_ADMIN_PASSWORD) : '';
if (process.env.SUPER_ADMIN_PASSWORD && !SUPER_PASS) console.log('  SUPER_ADMIN_PASSWORD must be at least 8 characters — super admin disabled.');
const SUPER_SECRET = crypto.createHash('sha256').update('meeqat-super:' + SUPER_PASS + ':' + (process.env.SUPER_SECRET || DATA)).digest();
const SUPPORT = String(process.env.SUPPORT_CONTACT || '').slice(0, 120); // shown on disabled screens / forgot PIN
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*').split(',').map((x) => x.trim().replace(/\/+$/, '')).filter(Boolean);
const MAX_SETTINGS = 512 * 1024;      // 512 KB of JSON
const MAX_AUDIO = 15 * 1024 * 1024;   // 15 MB per audio file
const MEDIA_NAMES = ['adhan', 'adhan-fajr', 'iqamah'];

for (const d of [DATA, SCREENS, MEDIA, LIBRARY]) fs.mkdirSync(d, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
  '.reg': 'application/octet-stream',
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

/* ---------- Adhan library (only the super admin uploads; every screen can select) ---------- */
const LIB_INDEX = path.join(LIBRARY, 'index.json');
function libLoad() { try { return JSON.parse(fs.readFileSync(LIB_INDEX, 'utf8')); } catch (e) { return []; } }
function libSave(list) { const tmp = LIB_INDEX + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(list, null, 1)); fs.renameSync(tmp, LIB_INDEX); }
function libFile(id) { const it = libLoad().find((x) => x.id === id); return it ? path.join(LIBRARY, it.file) : null; }
const LIB_KINDS = ['adhan', 'fajr', 'iqamah', 'other'];

/* ---------- TV pairing: TV shows a 6-digit code, admin enters it on the phone ---------- */
const pairs = new Map(); // code -> { token, id, exp, ip }
const pairRate = new Map();
setInterval(() => { const n = Date.now(); for (const [c, p] of pairs) if (p.exp < n - 3600000) pairs.delete(c); }, 600000);

/* ---------- Emergency PIN reset ----------
 * Set RESET_PIN="main:654321" (or several: "main:654321,masjid-huda-8e3a:1111") in the host's
 * environment variables and restart. The PIN is reset on boot; remove the variable afterwards. */
for (const pair of String(process.env.RESET_PIN || '').split(',').map((x) => x.trim()).filter(Boolean)) {
  const [rid, rpin] = pair.split(':').map((x) => (x || '').trim());
  const scr = load(rid);
  if (!scr) { console.log(`  RESET_PIN: screen "${rid}" not found`); continue; }
  if (!validPin(rpin)) { console.log(`  RESET_PIN: PIN for "${rid}" must be 4–12 digits`); continue; }
  scr.pin = hashPin(rpin); scr.pinIsDefault = false; delete scr.firstPin; save(rid, scr);
  console.log(`  RESET_PIN: PIN for screen "${rid}" has been reset. Remove RESET_PIN from the variables now.`);
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
  return { id, name: s.name, rev: s.rev, updated: s.updated, settings: s.settings, pinIsDefault: !!s.pinIsDefault, pending: !!s.pending, media: mediaMeta(id), owner: ownerPublic(s.owner) };
}
function ownerPublic(o) { return o ? { type: o.type, city: o.city, contact: o.contact, mobile: o.mobile, email: o.email } : null; }
const digits = (x) => String(x || '').replace(/\D/g, '');
const tail = (x) => digits(x).slice(-9);
function cleanOwner(b, old) {
  const o = Object.assign({}, old || {});
  if (b.type !== undefined) o.type = b.type === 'home' ? 'home' : 'masjid';
  if (b.city !== undefined) o.city = String(b.city || '').slice(0, 80);
  if (b.contact !== undefined) o.contact = String(b.contact || '').slice(0, 80);
  if (b.mobile !== undefined) o.mobile = String(b.mobile || '').replace(/[^\d+ -]/g, '').slice(0, 20);
  if (b.email !== undefined) o.email = String(b.email || '').slice(0, 120);
  return o;
}
function allScreens() {
  return fs.readdirSync(SCREENS).filter((f) => f.endsWith('.json')).map((f) => load(f.slice(0, -5))).filter(Boolean);
}
/* ---------- TVs of a screen (each TV device has its own random id + section) ---------- */
const TV_RE = /^[a-z0-9]{8,32}$/;
function tvList(id, scr) {
  const live = new Set([...(clients.get(id) || [])].map((r) => r.tvId).filter(Boolean));
  return Object.entries(scr.tvs || {}).map(([tid, t]) => ({ id: tid, name: t.name, section: t.section || '', added: t.added, lastSeen: t.lastSeen || null, online: live.has(tid) }))
    .sort((a, b) => (a.added || 0) - (b.added || 0));
}
/** Register / refresh a TV that is showing this screen. Returns its record. */
function seenTv(scr, tid, ua) {
  if (!TV_RE.test(String(tid || ''))) return null;
  scr.tvs = scr.tvs || {};
  const now = Date.now();
  let t = scr.tvs[tid], dirty = false;
  if (!t) {
    if (Object.keys(scr.tvs).length >= 50) return null;
    t = scr.tvs[tid] = { name: 'TV ' + (Object.keys(scr.tvs).length + 1), section: '', added: now, ua: String(ua || '').slice(0, 120) };
    dirty = true;
  }
  if (!t.lastSeen || now - t.lastSeen > 600000) { t.lastSeen = now; dirty = true; } else t.lastSeen = now;
  if (dirty) save(scr.id, scr);
  return t;
}

/* last time a TV fetched or streamed — persisted at most every 10 min */
const seen = new Map();
function touch(id, scr) {
  const now = Date.now(); seen.set(id, now);
  if (scr && (!scr.lastSeen || now - scr.lastSeen > 600000)) { scr.lastSeen = now; save(id, scr); }
}
/* registration rate limit: 5 per IP per day */
const regs = new Map();
function regAllowed(req) {
  const ip = ipOf(req), now = Date.now();
  const list = (regs.get(ip) || []).filter((t) => now - t < 86400000);
  regs.set(ip, list);
  return list.length < 5;
}
/* super-admin tokens: HMAC-signed, 12 h */
function superToken() {
  const exp = Date.now() + 12 * 3600 * 1000;
  return exp + '.' + crypto.createHmac('sha256', SUPER_SECRET).update(String(exp)).digest('hex');
}
function superOk(req) {
  if (!SUPER_PASS) return false;
  const [exp, sig] = String(req.headers['x-super'] || '').split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  const good = crypto.createHmac('sha256', SUPER_SECRET).update(exp).digest('hex');
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function deleteScreen(id) {
  cache.delete(id);
  try { fs.unlinkSync(screenFile(id)); } catch (e) { /* */ }
  fs.rmSync(path.join(MEDIA, id), { recursive: true, force: true });
}

/* ---------- Static files ---------- */
function serveStatic(req, res, urlPath) {
  let p = urlPath;
  if (p === '/tv' || p === '/display') p = '/index.html';
  else if (p === '/') p = '/index.html';
  else if (p === '/admin' || p === '/admin/' || p === '/control') p = '/admin.html';
  else if (p === '/register' || p === '/welcome' || p === '/start') p = '/welcome.html';
  else if (p === '/super' || p === '/super/') p = '/super.html';
  else if (p === '/pair' || p === '/link' || p === '/setup') p = '/pair.html';
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
function serveMedia(req, res, id, name, fileOverride) {
  const f = fileOverride || findMedia(id, name);
  if (!f || !fs.existsSync(f)) return send(res, 404, 'Not found');
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
    return send(res, 204, '', { 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Pin,X-Screen,X-Super', 'Access-Control-Expose-Headers': 'Content-Disposition', 'Access-Control-Max-Age': '86400' });
  }

  if (p === '/api/info' || p === '/healthz') return json(res, 200, { app: 'Miqat', version: VERSION, now: Date.now(), port: PORT, lan: ON_CLOUD ? [] : lanAddresses(), allowNew: ALLOW_NEW, registration: REGISTRATION, support: SUPPORT, superEnabled: !!SUPER_PASS });
  if (p === '/api/time') return json(res, 200, { now: Date.now() });

  /* ----- public self-registration ----- */
  if (p === '/api/register' && req.method === 'POST') {
    if (REGISTRATION === 'closed') return json(res, 403, { error: 'Registration is closed. Please contact the administrator.' + (SUPPORT ? ' ' + SUPPORT : '') });
    const b = await readJson(req, MAX_SETTINGS);
    if (b.website) return json(res, 400, { error: 'Rejected' });                       // honeypot
    if (!(+b.elapsed > 2500)) return json(res, 400, { error: 'Please take a moment to fill in the form.' });
    if (!regAllowed(req)) return json(res, 429, { error: 'Too many registrations from this network today. Try again tomorrow.' });
    const name = String(b.name || '').trim();
    if (name.length < 2 || name.length > 80) return json(res, 400, { error: 'Please enter the masjid / home name.' });
    if (digits(b.mobile).length < 8 || digits(b.mobile).length > 15) return json(res, 400, { error: 'Please enter a valid mobile number.' });
    if (!validPin(b.pin)) return json(res, 400, { error: 'PIN must be 4–12 digits.' });
    if (b.settings && JSON.stringify(b.settings).length > MAX_SETTINGS) return json(res, 400, { error: 'Settings too large' });
    let id; do { id = slug(name) + '-' + crypto.randomBytes(2).toString('hex'); } while (load(id));
    const scr = {
      id, name: name.slice(0, 80), pin: hashPin(b.pin), pinIsDefault: false,
      settings: b.settings && typeof b.settings === 'object' ? b.settings : null,
      owner: cleanOwner(b, {}), pending: REGISTRATION === 'approval', disabled: false,
      rev: 1, created: Date.now(), updated: Date.now(), registeredFrom: ipOf(req)
    };
    save(id, scr);
    regs.get(ipOf(req)).push(Date.now());
    console.log(`  + registered ${scr.owner.type} "${scr.name}" (${id}) ${scr.owner.city || ''}`);
    return json(res, 201, { ok: true, id, pending: scr.pending });
  }

  /* ----- log in with mobile number + PIN (finds the user's screens) ----- */
  if (p === '/api/find' && req.method === 'POST') {
    if (locked(req)) return json(res, 429, { error: 'Too many wrong tries. Try again in 5 minutes.' });
    const b = await readJson(req);
    const t = tail(b.mobile);
    if (t.length < 8 || !validPin(b.pin)) { noteFail(req); return json(res, 400, { error: 'Enter your mobile number and PIN.' }); }
    const found = allScreens().filter((x) => x.owner && tail(x.owner.mobile) === t && checkPin(b.pin, x.pin));
    if (!found.length) { noteFail(req); return json(res, 401, { error: 'No screen found for this mobile number and PIN.' + (SUPPORT ? ' Help: ' + SUPPORT : '') }); }
    noteOk(req);
    return json(res, 200, { ok: true, screens: found.map((x) => ({ id: x.id, name: x.name, city: x.owner.city, type: x.owner.type, disabled: !!x.disabled, pending: !!x.pending })) });
  }

  /* ----- super admin ----- */
  if (p.startsWith('/api/super/')) {
    if (!SUPER_PASS) return json(res, 503, { error: 'Super admin is not enabled. Set SUPER_ADMIN_PASSWORD on the server.' });
    if (p === '/api/super/login' && req.method === 'POST') {
      if (locked(req)) return json(res, 429, { error: 'Too many wrong tries. Try again in 5 minutes.' });
      const b = await readJson(req);
      const a = crypto.createHash('sha256').update(String(b.password || '')).digest();
      const c = crypto.createHash('sha256').update(SUPER_PASS).digest();
      if (!crypto.timingSafeEqual(a, c)) { noteFail(req); return json(res, 401, { error: 'Wrong password' }); }
      noteOk(req);
      return json(res, 200, { ok: true, token: superToken() });
    }
    if (!superOk(req)) return json(res, 401, { error: 'Please log in again.' });
    /* the Super Admin app is never public: only a logged-in super admin can download it */
    if (p === '/api/super/app' && req.method === 'GET') {
      const f = path.join(ROOT, 'private', 'meeqat-super.apk');
      if (!fs.existsSync(f)) return json(res, 404, { error: 'The Super Admin app has not been built yet.' });
      const st = fs.statSync(f);
      res.writeHead(200, { 'Content-Type': MIME['.apk'], 'Content-Length': st.size, 'Content-Disposition': 'attachment; filename="meeqat-super.apk"', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': corsOrigin(req) });
      return fs.createReadStream(f).pipe(res);
    }
    if (p === '/api/super/library' && req.method === 'GET') {
      const used = {};
      for (const x of allScreens()) { const a = (((x.settings || {}).adhan || {}).audio) || {}; for (const k of ['main', 'fajr', 'iqamah']) if (a[k]) used[a[k]] = (used[a[k]] || 0) + 1; }
      return json(res, 200, { ok: true, items: libLoad().map((x) => Object.assign({}, x, { uses: used[x.id] || 0 })) });
    }
    if (p === '/api/super/library' && req.method === 'PUT') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const ext = AUDIO_EXT[type];
      if (!ext) return json(res, 415, { error: 'Please upload an MP3, M4A, AAC, OGG or WAV file.' });
      const name = String(url.searchParams.get('name') || '').trim().slice(0, 80) || 'Adhan';
      const kind = LIB_KINDS.includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'adhan';
      const buf = await readBody(req, MAX_AUDIO);
      if (!buf.length) return json(res, 400, { error: 'Empty file' });
      const id = crypto.randomBytes(5).toString('hex');
      fs.writeFileSync(path.join(LIBRARY, id + ext), buf);
      const list = libLoad(); list.push({ id, name, kind, file: id + ext, size: buf.length, created: Date.now() }); libSave(list);
      console.log(`  + library: "${name}" (${kind}, ${(buf.length / 1048576).toFixed(1)} MB)`);
      return json(res, 201, { ok: true, id });
    }
    const lb = /^\/api\/super\/library\/([a-z0-9]+)$/.exec(p);
    if (lb) {
      const list = libLoad(), it = list.find((x) => x.id === lb[1]);
      if (!it) return json(res, 404, { error: 'Not found' });
      if (req.method === 'DELETE') {
        try { fs.unlinkSync(path.join(LIBRARY, it.file)); } catch (e) { /* */ }
        libSave(list.filter((x) => x.id !== it.id));
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST') {
        const b = await readJson(req);
        if (b.name) it.name = String(b.name).trim().slice(0, 80);
        if (LIB_KINDS.includes(b.kind)) it.kind = b.kind;
        libSave(list); return json(res, 200, { ok: true });
      }
    }
    if (p === '/api/super/screens' && req.method === 'GET') {
      const list = allScreens().map((x) => {
        const st = x.settings || {}, loc = st.location || {}, gen = st.general || {};
        return {
          id: x.id, name: x.name, displayName: gen.masjidName || x.name, type: (x.owner && x.owner.type) || 'masjid',
          city: [loc.area, loc.city].filter(Boolean).join(', ') || (x.owner && x.owner.city) || '',
          region: [loc.region, loc.country].filter(Boolean).join(', '), contact: x.owner ? x.owner.contact : '', mobile: x.owner ? x.owner.mobile : '', email: x.owner ? x.owner.email : '',
          created: x.created, updated: x.updated, rev: x.rev, lastSeen: Math.max(seen.get(x.id) || 0, x.lastSeen || 0) || null,
          live: (clients.get(x.id) || new Set()).size, disabled: !!x.disabled, pending: !!x.pending, pinIsDefault: !!x.pinIsDefault,
          lang: gen.lang || 'en', lat: loc.lat, lng: loc.lng
        };
      }).sort((a, b) => (b.created || 0) - (a.created || 0));
      return json(res, 200, { ok: true, now: Date.now(), registration: REGISTRATION, screens: list });
    }
    const sm = /^\/api\/super\/screens\/([a-z0-9-]+)$/.exec(p);
    if (sm) {
      const id = sm[1], scr = load(id);
      if (!scr) return json(res, 404, { error: 'Not found' });
      if (req.method === 'DELETE') {
        broadcast(id, 'settings', { rev: -1 });
        deleteScreen(id);
        console.log(`  - super admin deleted "${scr.name}" (${id})`);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST') {
        const b = await readJson(req);
        if (b.action === 'disable') scr.disabled = true;
        else if (b.action === 'enable') scr.disabled = false;
        else if (b.action === 'approve') scr.pending = false;
        else if (b.action === 'resetPin') { if (!validPin(b.pin)) return json(res, 400, { error: 'PIN must be 4–12 digits.' }); scr.pin = hashPin(b.pin); scr.pinIsDefault = false; delete scr.firstPin; }
        else if (b.action === 'owner') scr.owner = cleanOwner(b.owner || {}, scr.owner);
        else return json(res, 400, { error: 'Unknown action' });
        scr.rev = (scr.rev || 0) + 1; scr.updated = Date.now(); save(id, scr);
        broadcast(id, 'settings', { rev: scr.rev });
        return json(res, 200, { ok: true });
      }
    }
    return json(res, 404, { error: 'Not found' });
  }

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
    const scr = { id, name: String(b.name || 'New screen').slice(0, 80), pin: hashPin(b.pin), pinIsDefault: false, settings: b.settings || null, owner: cleanOwner(b.owner || {}, {}), rev: 1, created: Date.now(), updated: Date.now() };
    save(id, scr);
    return json(res, 201, { ok: true, id });
  }

  /* ----- short link for the TV app download (easy to type in the Downloader app) ----- */
  const APK_LINKS = { '/app': 'meeqat-tv.apk', '/apk': 'meeqat-tv.apk', '/tvapp': 'meeqat-tv.apk', '/tv-app': 'meeqat-tv.apk', '/admin-app': 'meeqat-admin.apk', '/adminapp': 'meeqat-admin.apk' };
  if (APK_LINKS[p]) {
    const f = path.join(PUB, 'downloads', APK_LINKS[p]);
    if (!fs.existsSync(f)) return send(res, 404, 'This Meeqat app is not built yet.', { 'Content-Type': 'text/plain' });
    return send(res, 302, '', { Location: '/downloads/' + APK_LINKS[p] });
  }

  /* ----- TV pairing ----- */
  if (p === '/api/pair' && req.method === 'POST') {
    const ip = ipOf(req), now = Date.now();
    const list = (pairRate.get(ip) || []).filter((t) => now - t < 3600000);
    if (list.length >= 30) return json(res, 429, { error: 'Too many codes requested. Wait a few minutes.' });
    list.push(now); pairRate.set(ip, list);
    let code; do { code = String(crypto.randomInt(100000, 1000000)); } while (pairs.has(code));
    const token = crypto.randomBytes(16).toString('hex');
    let pb = {}; try { pb = await readJson(req); } catch (e) { /* no body */ }
    pairs.set(code, { token, id: null, exp: now + 20 * 60000, ip, tv: TV_RE.test(String(pb.tv || '')) ? pb.tv : null });
    return json(res, 201, { ok: true, code, token, exp: now + 20 * 60000 });
  }
  let pm = /^\/api\/pair\/(\d{6})$/.exec(p);
  if (pm && req.method === 'GET') {
    const pr = pairs.get(pm[1]);
    if (!pr || pr.token !== url.searchParams.get('token')) return json(res, 404, { error: 'Unknown code' });
    if (!pr.id && pr.exp < Date.now()) return json(res, 410, { error: 'Code expired' });
    const scr = pr.id ? load(pr.id) : null;
    return json(res, 200, { ok: true, linked: !!pr.id, id: pr.id, name: scr ? scr.name : null });
  }

  /* ----- adhan library: public list + audio ----- */
  if (p === '/api/library' && req.method === 'GET') {
    return json(res, 200, { ok: true, items: libLoad().map((x) => ({ id: x.id, name: x.name, kind: x.kind, size: x.size, v: x.created })) });
  }
  let lm = /^\/library\/([a-z0-9]+)$/.exec(p);
  if (lm && (req.method === 'GET' || req.method === 'HEAD')) return serveMedia(req, res, null, null, libFile(lm[1]));

  let m = /^\/media\/([a-z0-9-]+)\/([a-z-]+)$/.exec(p);
  if (m && (req.method === 'GET' || req.method === 'HEAD')) return serveMedia(req, res, m[1], m[2]);

  m = /^\/api\/screens\/([a-z0-9-]+)(?:\/([a-z]+))?(?:\/([a-z0-9-]+))?$/.exec(p);
  if (m) {
    const [, id, action, sub] = m;
    const scr = load(id);
    if (!scr) return json(res, 404, { error: 'Screen not found: ' + id });
    if (scr.disabled && action !== 'events') return json(res, 403, { error: 'This screen has been disabled by the administrator.' + (SUPPORT ? ' Contact: ' + SUPPORT : ''), disabled: true, support: SUPPORT });

    if (!action && req.method === 'GET') {
      touch(id, scr);
      const tid = url.searchParams.get('tv');
      const t = tid ? seenTv(scr, tid, req.headers['user-agent']) : null;
      return json(res, 200, Object.assign(publicScreen(id, scr), t ? { tv: { id: tid, name: t.name, section: t.section || '' } } : {}));
    }

    if (action === 'events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': corsOrigin(req), 'Vary': 'Origin' });
      res.write(`retry: 5000\nevent: hello\ndata: ${JSON.stringify({ rev: scr.rev, now: Date.now() })}\n\n`);
      if (!clients.has(id)) clients.set(id, new Set());
      const tid = url.searchParams.get('tv');
      if (tid && TV_RE.test(tid)) { res.tvId = tid; seenTv(scr, tid, req.headers['user-agent']); }
      clients.get(id).add(res);
      touch(id, scr);
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
      if (b.owner && typeof b.owner === 'object') scr.owner = cleanOwner(b.owner, scr.owner);
      scr.rev = (scr.rev || 0) + 1; scr.updated = Date.now();
      save(id, scr);
      const viewers = broadcast(id, 'settings', { rev: scr.rev });
      return json(res, 200, { ok: true, rev: scr.rev, viewers });
    }

    if (action === 'link' && req.method === 'POST') {
      if (!auth(req, res, scr)) return;
      const b = await readJson(req);
      const pr = pairs.get(String(b.code || '').replace(/\D/g, ''));
      if (!pr || pr.exp < Date.now()) return json(res, 404, { error: 'Code not found or expired. Check the code on the TV.' });
      pr.id = id;
      if (pr.tv) {
        const sections = ((scr.settings || {}).sections || []).map((x) => x.id);
        const t = seenTv(scr, pr.tv, '');
        if (t) {
          if (b.name) t.name = String(b.name).trim().slice(0, 40) || t.name;
          if (b.section !== undefined) t.section = sections.includes(b.section) ? b.section : '';
          save(id, scr);
        }
      }
      console.log(`  ~ TV linked to "${scr.name}" (${id})`);
      return json(res, 200, { ok: true });
    }

    if (action === 'tvs') {
      if (!auth(req, res, scr)) return;
      if (req.method === 'GET' && !sub) return json(res, 200, { ok: true, tvs: tvList(id, scr) });
      if (sub && scr.tvs && scr.tvs[sub]) {
        if (req.method === 'DELETE') { delete scr.tvs[sub]; save(id, scr); return json(res, 200, { ok: true }); }
        if (req.method === 'PUT') {
          const b = await readJson(req);
          const t = scr.tvs[sub];
          if (b.name !== undefined) t.name = String(b.name).trim().slice(0, 40) || t.name;
          if (b.section !== undefined) { const ok = ((scr.settings || {}).sections || []).some((x) => x.id === b.section); t.section = ok ? b.section : ''; }
          save(id, scr);
          broadcast(id, 'settings', { rev: scr.rev, tv: sub });
          return json(res, 200, { ok: true });
        }
      }
      return json(res, 404, { error: 'TV not found' });
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
      const allowed = ['reload', 'test-adhan', 'test-iqamah', 'test-salah', 'test-adhkar', 'identify', 'stop', 'fullscreen', 'exit-fullscreen'];
      if (!allowed.includes(b.type)) return json(res, 400, { error: 'Unknown command' });
      const tv = TV_RE.test(String(b.tv || '')) ? b.tv : null;   // optional: only one TV
      const viewers = broadcast(id, 'command', { type: b.type, prayer: b.prayer || 'dhuhr', tv, at: Date.now() });
      return json(res, 200, { ok: true, viewers });
    }

    if (action === 'media' && sub && MEDIA_NAMES.includes(sub)) {
      if (!superOk(req)) return json(res, 403, { error: 'Adhan audio is managed by the Meeqat administrator. Choose one from the adhan library.' });
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
  console.log(`  Register    : /register   ·  Super admin: /super ${SUPER_PASS ? '(enabled)' : '(set SUPER_ADMIN_PASSWORD to enable)'}`);
  console.log(`  Registration: ${REGISTRATION}`);
  console.log(`  Data folder : ${DATA}\n${line}\n`);
});

function shutdown() { console.log('Shutting down…'); for (const set of clients.values()) for (const r of set) { try { r.end(); } catch (e) { /* */ } } server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
