/* Miqat service worker — keeps the display working when the internet drops (HTTPS / localhost only). */
const CACHE = 'miqat-v1.1.0';
const SHELL = ['./', 'index.html', 'admin.html', 'shared.js', 'config.js', 'manifest.webmanifest', 'icon.svg',
  'vendor/adhan.min.js', 'vendor/qrcode.js',
  'fonts/outfit-latin-300-normal.woff2', 'fonts/outfit-latin-400-normal.woff2', 'fonts/outfit-latin-500-normal.woff2',
  'fonts/outfit-latin-600-normal.woff2', 'fonts/outfit-latin-700-normal.woff2',
  'fonts/amiri-arabic-400-normal.woff2', 'fonts/amiri-arabic-700-normal.woff2',
  'fonts/noto-sans-malayalam-malayalam-400-normal.woff2', 'fonts/noto-sans-malayalam-malayalam-600-normal.woff2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/events')) return;            // live stream: never cache
  if (u.pathname.startsWith('/api/')) return;            // settings: app keeps its own offline copy
  if (u.pathname.startsWith('/media/')) {                 // adhan audio: cache-first
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok && r.status === 200) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // app shell: network-first so updates show immediately, cache when offline
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
