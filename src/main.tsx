import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import './index.css'

/**
 * No app instalado no iPhone (modo "standalone") o iOS às vezes entrega uma área menor que
 * a tela e deixa uma faixa embaixo onde o app não consegue desenhar. Nesse caso marcamos o
 * <html> com .ios-faixa: a faixa é pintada da cor do menu (parece a continuação dele) e o
 * menu dispensa o espaço extra da barrinha do iPhone.
 */
function updateAppHeight() {
  const h = window.innerHeight
  let faixa = false
  if ((navigator as Navigator & { standalone?: boolean }).standalone) {
    const portrait = window.matchMedia('(orientation: portrait)').matches
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    faixa = screenH - h > 8
  }
  document.documentElement.style.setProperty('--app-h', `${h}px`)
  document.documentElement.classList.toggle('ios-faixa', faixa)
}
updateAppHeight()
window.addEventListener('resize', updateAppHeight)
window.addEventListener('orientationchange', () => setTimeout(updateAppHeight, 300))

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
