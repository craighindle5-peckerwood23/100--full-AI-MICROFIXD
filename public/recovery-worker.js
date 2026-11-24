// Only the public, credential-free recovery document is retained.
const recovery = '/recovery.html';
const cacheName = 'microfixd-recovery-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(recovery, {cache: 'reload', credentials: 'omit', redirect: 'error'});
    if (!response.ok || !(await response.clone().text()).includes('data-microfixd-recovery="1"')) {
      throw new Error('Recovery document unavailable');
    }
    const cache = await caches.open(cacheName);
    await cache.put(recovery, response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || req.mode !== 'navigate' || url.origin !== self.location.origin ||
      !['/', recovery].includes(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(req, {signal: AbortSignal.timeout(10000)});
      if (response.status < 500) return response;
      return (await caches.match(recovery, {cacheName})) || response;
    } catch {
      return (await caches.match(recovery, {cacheName})) || Response.error();
    }
  })());
});
