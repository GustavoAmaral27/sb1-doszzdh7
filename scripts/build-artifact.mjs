// Gera dist-artifact/financeiro.html: o app inteiro (CSS + JS) num único arquivo,
// no formato aceito pelo Artifact do claude.ai (sem <html>/<head>/<body>).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const cssFile = html.match(/href="\.\/(assets\/[^"]+\.css)"/)?.[1]
const jsFile = html.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1]
if (!cssFile || !jsFile) throw new Error('Rode "vite build" antes: assets não encontrados em dist/index.html')

const css = readFileSync(join(dist, cssFile), 'utf8')
const js = readFileSync(join(dist, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script')

const page = `<title>Financeiro Z-TEC & Amaral</title>
<meta name="theme-color" content="#0f172a">
<meta name="apple-mobile-web-app-title" content="Financeiro">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
mkdirSync('dist-artifact', { recursive: true })
writeFileSync('dist-artifact/financeiro.html', page)
console.log(`dist-artifact/financeiro.html (${(page.length / 1024).toFixed(0)} KB)`)
