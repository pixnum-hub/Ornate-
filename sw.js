// ═══════════════════════════════════════════════════════════
// ORNATE Service Worker v3.0
// © Manik Roy 2026. All Rights Reserved.
// ═══════════════════════════════════════════════════════════

const CACHE_NAME   = 'ornate-v3';
const OFFLINE_PAGE = 'offline.html';
const APP_PAGE     = 'jewellery-calculator.html';

const PRECACHE = [
  APP_PAGE,
  OFFLINE_PAGE,
  'manifest.json',
  'icon-192x192.png',
  'icon-512x512.png',
  'apple-touch-icon.png',
  'favicon.ico',
];

const BYPASS_HOSTS = [
  'api.exchangerate.host',
  'api.frankfurter.app',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[ORNATE SW v3] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(e => console.warn('[ORNATE SW] Pre-cache partial:', e)))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: purge old caches ───────────────────────────────
self.addEventListener('activate', event => {
  console.log('[ORNATE SW v3] Activating, purging old caches…');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: stale-while-revalidate ────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Revalidate in background
      const networkFetch = fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      }).catch(() => null);

      return cached || networkFetch.then(resp => resp || (
        event.request.mode === 'navigate' ? caches.match(OFFLINE_PAGE) : null
      ));
    })
  );
});

// ── BACKGROUND SYNC ──────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'price-refresh') {
    event.waitUntil(
      Promise.allSettled([
        fetch('https://api.frankfurter.app/latest?from=USD&to=INR')
          .then(r => r.json())
          .then(d => { if (d?.rates?.INR) broadcast({ type: 'INR_RATE', rate: d.rates.INR }); }),
        fetch('https://api.exchangerate.host/latest?base=USD&symbols=XAU,XAG,XPT,XPD')
          .then(r => r.json())
          .then(d => { if (d?.rates) broadcast({ type: 'SPOT_RATES', rates: d.rates }); }),
      ])
    );
  }
});

// ── PUSH ─────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const p = event.data?.json() ?? { title: 'ORNATE', body: 'New price data available.', tag: 'price-update' };
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body, icon: 'icon-192x192.png', badge: 'icon-96x96.png',
      tag: p.tag ?? 'ornate', vibrate: [150, 60, 150], data: { url: p.url ?? APP_PAGE },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url ?? APP_PAGE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(APP_PAGE) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

function broadcast(msg) {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    .then(clients => clients.forEach(c => c.postMessage(msg)));
}
