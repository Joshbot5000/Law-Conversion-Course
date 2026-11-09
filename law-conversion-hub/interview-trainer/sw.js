/*
 * sw.js: lets the trainer open with no internet connection.
 *
 * App files are served from the stored copy at once and refreshed in the
 * background, so updates arrive on the next launch. Requests to other sites
 * (the Claude API, speech services) are never touched. Offline, the app still
 * runs interviews with offline follow-ups and estimated marks.
 * Bump VERSION whenever any app file changes.
 */
const VERSION = 'interview-trainer-v1';
const CORE = [
  './',
  'index.html',
  'vendor/anthropic-sdk-1.3.0.js',
  'data/bank.js',
  'data/firms.js',
  'js/store.js',
  'js/coach.js',
  'js/ai.js',
  'js/media.js',
  'js/interview.js',
  'js/app.js',
  'js/app-pages.js',
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

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.open(VERSION).then(cache => cache.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return;

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
