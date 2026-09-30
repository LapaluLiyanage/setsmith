// Minimal service worker: just enough for the app to be installable, plus a cache-first
// assist for this build's own hashed JS/CSS/font/icon files. Everything else (HTML, the
// Supabase API, YouTube) always goes to the network -- this is a live-sync tool, so nothing
// here may ever serve stale setlist data.
const CACHE = 'setsmith-assets-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isCacheable(url) {
  return url.origin === self.location.origin
    && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (!isCacheable(url)) return // let the browser handle everything else normally

  e.respondWith(
    caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()))
      return res
    })),
  )
})
