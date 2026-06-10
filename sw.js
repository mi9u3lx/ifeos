const CACHE = 'lifeos-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);

  // GitHub-API (Sync) niemals abfangen
  if (u.host === 'api.github.com') return;

  if (u.origin === location.origin) {
    // App-Shell: Netz zuerst (Updates kommen an), Cache als Offline-Fallback
    if (e.request.mode === 'navigate') {
      e.respondWith(
        fetch(e.request).then(r => {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', cp));
          return r;
        }).catch(() => caches.match('./index.html'))
      );
      return;
    }
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }

  // CDN-Assets (React, Tailwind, Babel, Fonts): stale-while-revalidate → offlinefähig
  if (/unpkg\.com|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u.host)) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request);
        const net = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
