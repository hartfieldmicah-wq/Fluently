/* Fluently service worker: makes the app open and speak with no internet.
   - The app page: network first (so updates arrive), falls back to the saved copy offline.
   - App files (icons, manifest): saved on install.
   - Voice engine code from the CDN: saved the first time it loads, then used forever.
   - Voice models: saved the first time they download, so they never download again (until the language is removed).
   - Account/sync requests (Supabase) pass straight through. */
const VERSION = 'fluently-v13';
const CDN_CACHE = 'fluently-cdn-v1';
const VOICE_CACHE = 'fluently-models-1'; /* voice model files: saved once, removed only when you remove that language */
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(new Request(url, {cache: 'reload'})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('fluently-v') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

async function pageRequest(request) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await Promise.race([fetch(request, {cache: 'no-store'}), timeout(8000)]);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
      cache.put('./', fresh.clone());
    }
    return fresh;
  } catch (e) {
    return (await cache.match(request, {ignoreSearch: true})) || (await cache.match('./')) || (await cache.match('./index.html')) ||
      new Response('<h1>Offline</h1><p>Open Fluently once with internet so it can be saved for offline use.</p>', {headers: {'Content-Type': 'text/html'}});
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request, {ignoreSearch: true});
  const update = fetch(request).then(res => { if (res && res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
  return hit || (await update) || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(pageRequest(req));
    return;
  }
  /* the app's own update check always asks the network */
  if (url.origin === self.location.origin && url.searchParams.has('build-check')) return;
  /* language files are downloaded and stored by the app itself */
  if (url.origin === self.location.origin && url.pathname.includes('/lang/')) return;
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(req, CDN_CACHE));
    return;
  }
  if (url.hostname === 'huggingface.co' || url.hostname.endsWith('.hf.co') || url.hostname.endsWith('.huggingface.co')) {
    event.respondWith(cacheFirst(req, VOICE_CACHE));
    return;
  }
  /* everything else (Supabase accounts/sync, Hugging Face voice download) goes to the network as normal */
});
