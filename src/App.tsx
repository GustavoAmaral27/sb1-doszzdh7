import { useState } from 'react'
import { ArrowDownCircle, Cloud, HardDrive, ArrowUpCircle, LayoutDashboard, LineChart, Settings as SettingsIcon } from 'lucide-react'
import CompanySelector from './components/CompanySelector'
import Dashboard from './pages/Dashboard'
import Contas from './pages/Contas'
import FluxoCaixa from './pages/FluxoCaixa'
import Ajustes from './pages/Ajustes'
import { cn } from './lib/utils'
import { useStore } from './store'

export type Tab = 'inicio' | 'pagar' | 'receber' | 'fluxo' | 'ajustes'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'inicio', label: 'Início', icon: LayoutDashboard },
  { id: 'pagar', label: 'A pagar', icon: ArrowUpCircle },
  { id: 'receber', label: 'A receber', icon: ArrowDownCircle },
  { id: 'fluxo', label: 'Fluxo', icon: LineChart },
  { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('inicio')

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col text-slate-900 dark:text-slate-100">
      <header className="sticky-top sticky z-20 bg-slate-900 text-white shadow-md">
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold leading-tight">Financeiro</h1>
            <SyncStatus />
          </div>
          <p className="text-xs text-slate-400">Z-TEC Quarteirização Contábil · Amaral Contabilidade</p>
          <div className="mt-3">
            <CompanySelector />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        {tab === 'inicio' && <Dashboard onNavigate={setTab} />}
        {tab === 'pagar' && <Contas key="pagar" type="pagar" />}
        {tab === 'receber' && <Contas key="receber" type="receber" />}
        {tab === 'fluxo' && <FluxoCaixa />}
        {tab === 'ajustes' && <Ajustes />}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id)
                window.scrollTo({ top: 0 })
              }}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
                tab === id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={tab === id ? 2.4 : 1.8} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

function SyncStatus() {
  const { mode, error } = useStore()
  if (error) return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-200">{error}</span>
  const label = { carregando: 'Conectando…', nuvem: 'Salvo na nuvem', local: 'Salvo no celular' }[mode]
  const Icon = mode === 'nuvem' ? Cloud : HardDrive
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  )
}
