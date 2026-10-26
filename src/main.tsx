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

// Guarda o app no aparelho para abrir sem internet e pede ao navegador para não apagar os dados salvos.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker?.register('./sw.js').catch(() => {})
    navigator.storage?.persist?.().catch(() => {})
  })
}
