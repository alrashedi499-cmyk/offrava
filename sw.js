/* Offrava service worker: fast app loading + phone/browser push notifications. */
const CACHE = 'offrava-v11';
const FILES = ['./', './index.html', './styles.css', './app.js', './auth.js', './market.js', './addresses.js', './orders.js', './features.js', './photo-studio.js', './ads.js', './services.js', './makers.js', './admin.js', './config.js', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.endsWith('-model')).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Only our own files are cached (never account data or payments). The photo model is cached after first use.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('.onnx')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE + '-model').then((c) => c.put(e.request, copy)); return res; })));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});

// Push notification arrives
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Offrava', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Offrava', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag, data: { link: d.link || '#/notifications' }
  }));
});

// Tap on a notification: open the right page in the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL('./' + (e.notification.data && e.notification.data.link || '#/notifications'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope)) { c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
