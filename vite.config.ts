import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  // Duas páginas: o app financeiro (raiz) e o painel de MEIs para contadores (/contadores/).
  build: { rollupOptions: { input: { main: 'index.html', contadores: 'contadores/index.html' } } },
})
