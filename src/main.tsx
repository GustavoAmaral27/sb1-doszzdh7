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
    navigator.serviceWorker
      ?.register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Procura versão nova sempre que o app volta para a tela.
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}))
      })
      .catch(() => {})
    // Quando uma versão nova assume, recarrega uma vez para mostrá-la.
    // (não recarrega na primeira instalação, quando ainda não havia versão anterior)
    const hadController = !!navigator.serviceWorker?.controller
    let reloaded = false
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return
      reloaded = true
      window.location.reload()
    })
    navigator.storage?.persist?.().catch(() => {})
  })
}
