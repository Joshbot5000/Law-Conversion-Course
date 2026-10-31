/*
 * sw.js: lets the trainer open and run with no internet connection.
 *
 * On first visit it stores every file the app needs. After that, pages are
 * served from the stored copy straight away and refreshed in the background
 * when online, so updates arrive on the next launch. Google Fonts are stored
 * the first time they load; offline before that, the page falls back to
 * system fonts. Bump VERSION whenever the app's files change.
 */
const VERSION = 'wg-trainer-v4';
const CORE = [
  './',
  'index.html',
  'content.js',
  'bank-inference.js',
  'bank-reasoning.js',
  'bank-logic.js',
  'bank-test.js',
  'engine.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: use the stored copy if there is one, otherwise fetch and store it.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.open(VERSION).then(cache => cache.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // App files: answer from the stored copy at once, refresh it in the background.
  event.respondWith(caches.open(VERSION).then(cache =>
    cache.match(req, { ignoreSearch: true }).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { event.waitUntil(refresh); return hit; }
      return refresh.then(res => res || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
    })
  ));
});
