import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  // Duas páginas: o app financeiro (raiz) e o sistema para MEIs (/mei/).
  build: { rollupOptions: { input: { main: 'index.html', mei: 'mei/index.html' } } },
})
