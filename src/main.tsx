import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)

// Fora do claude.ai (hospedagem própria), registra o service worker para funcionar offline.
// Fora do claude.ai (hospedagem própria): guarda o app no aparelho para abrir sem internet
// e pede ao navegador para não apagar os dados salvos.
if (import.meta.env.PROD && !window.claude) {
  window.addEventListener('load', () => {
    navigator.serviceWorker?.register('./sw.js').catch(() => {})
    navigator.storage?.persist?.().catch(() => {})
  })
}
