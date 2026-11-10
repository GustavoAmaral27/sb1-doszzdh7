import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Landing from './Landing'
import Painel from './Painel'
import './contadores.css'

function App() {
  const [rota, setRota] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => {
      setRota(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return rota.startsWith('#/painel') ? <Painel /> : <Landing />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
