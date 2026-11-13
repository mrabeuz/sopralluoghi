/* Service worker: rende l'app disponibile offline.
 * Quando pubblichi una nuova versione dei file, aumenta il numero di VERSIONE. */
const VERSIONE = 'v1';
const CACHE = 'sopralluoghi-' + VERSIONE;
const SHELL = ['./', './index.html', './app.js', './config.js', './manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './lib/xlsx.full.min.js', './lib/jspdf.umd.min.js', './lib/jszip.min.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sopralluoghi-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // le chiamate al server (POST) passano sempre in rete
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // file dell'app: risposta subito dalla cache, aggiornamento in background
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = await c.match(req, { ignoreSearch: req.mode === 'navigate' }) ||
      (req.mode === 'navigate' ? await c.match('./index.html') : null);
    const net = fetch(req).then(res => {
      if (res.ok && res.type === 'basic') c.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const res = await net;
    return res || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
