// App-shell cache only. Never touches cross-origin requests (Supabase) and never caches data or tokens.
const V = 'mif-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.add('/'))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put('/', c)); return res; }).catch(() => caches.match('/'))); return; }
  if (u.pathname.startsWith('/assets/')) e.respondWith(caches.match(r).then((h) => h || fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); return res; })));
});
