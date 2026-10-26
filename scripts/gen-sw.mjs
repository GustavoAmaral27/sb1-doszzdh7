// Gera dist/sw.js com a lista de todos os arquivos do build, para o app
// ficar inteiro guardado no celular já na primeira abertura e funcionar sem internet.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const dist = 'dist'
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (name !== 'sw.js') files.push(relative(dist, p).split('\\').join('/'))
  }
}
walk(dist)

const hash = createHash('sha256')
for (const f of files.sort()) hash.update(f).update(readFileSync(join(dist, f)))
const version = hash.digest('hex').slice(0, 12)
const precache = ['./', ...files.map((f) => './' + f)]

const sw = `// Gerado por scripts/gen-sw.mjs — não editar à mão.
const CACHE = 'financeiro-${version}'
const PRECACHE = ${JSON.stringify(precache, null, 2)}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('financeiro-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return

  // Páginas: tenta a internet (para pegar atualizações) e, sem conexão, usa a cópia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((r) => r || caches.match('./index.html'))),
    )
    return
  }

  // Arquivos do app: usa a cópia guardada (rápido e offline).
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)))
})
`
writeFileSync(join(dist, 'sw.js'), sw)
console.log(`dist/sw.js: ${precache.length} arquivos, versão ${version}`)
