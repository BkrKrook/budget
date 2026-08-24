/* Offlinestöd: den installerade appen ska gå att öppna utan nätverk –
 * all data finns ju redan lokalt i webbläsaren.
 *
 * Strategi:
 * - Navigeringar: nätet först, så att nya versioner når användaren direkt;
 *   det cachade appskalet är reserv offline.
 * - Övriga filer (Vite-bygget har hashade, oföränderliga namn): cachen
 *   först, fylls på från nätet vid första hämtningen.
 *
 * Gamla byggens filer ligger kvar i cachen tills versionen nedan höjs –
 * då rensas allt cachat i activate. */
const CACHE = 'minbudget-sw-v1'

/* Appskalets cachenyckel: './' är appens rot oavsett var den publiceras
 * (jfr base './' i vite.config.ts). */
const SHELL = './'

/* URL:en ensam identifierar varje fil här. Utan ignoreVary missar cachen
 * bakom servrar som skickar "Vary: Origin": modulskript begärs med
 * Origin-huvud, medan de precachade svaren hämtades utan. */
const MATCH_OPTS = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Precacha appskalet OCH filerna det pekar på. Vid första besöket
      // kontrollerar workern inte sidan än, så utan detta hamnar varken
      // JS eller CSS i cachen och appen blir tom offline.
      // 'no-cache' revaliderar mot servern – installationen sker just när en
      // ny version rullas ut och ska inte precacha ett gammalt HTTP-cachat skal.
      const res = await fetch(SHELL, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`Kunde inte hämta appskalet (${res.status})`)
      await cache.put(SHELL, res.clone())
      const urls = [...(await res.text()).matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => !/^(?:[a-z]+:|\/\/)/i.test(u))
      await cache.addAll([...new Set(urls)])
      await self.skipWaiting()
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return

  // Appen är en enda sida: alla navigeringar serverar appskalet.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Klona synkront, innan svaret börjar strömmas till sidan.
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(SHELL, copy))
          }
          return res
        })
        .catch(() => caches.match(SHELL, MATCH_OPTS).then((hit) => hit ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(req, MATCH_OPTS).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        }),
    ),
  )
})
