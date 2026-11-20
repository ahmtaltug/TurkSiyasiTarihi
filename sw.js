/* Türkiye Seçim Atlası — çevrimdışı önbellek.
   Veri ve sınır dosyaları önce önbellekten; sayfa, kod ve listeler ağdan (yoksa önbellekten). */
const VERSION = 'secim-atlasi-3.2.0';
const CORE = ['./', 'index.html', 'css/app.css?v=3.2.0', 'js/app.js?v=3.2.0', 'js/history.js?v=3.2.0', 'vendor/leaflet.js', 'vendor/leaflet.css',
  'vendor/topojson-client.min.js', 'data/index.json', 'data/parties.json',  'data/geo/world.json', 'favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const immutable = /\/data\/(elections|geo)\/|\/vendor\//.test(url.pathname);
  if (immutable) {
    // önce önbellek: sürüm değişince önbellek adı değişir ve eski dosyalar silinir
    e.respondWith(caches.open(VERSION).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }))));
  } else {
    // önce ağ, ağ yoksa önbellek
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
  }
});
