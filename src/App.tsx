import { useState } from 'react'
import { ArrowDownCircle, Cloud, CloudOff, HardDrive, RefreshCw, ArrowUpCircle, LayoutDashboard, LineChart, Settings as SettingsIcon } from 'lucide-react'
import CompanySelector from './components/CompanySelector'
import Dashboard from './pages/Dashboard'
import Contas from './pages/Contas'
import FluxoCaixa from './pages/FluxoCaixa'
import Ajustes from './pages/Ajustes'
import MonthNav from './components/MonthNav'
import { FIRST_MONTH } from './lib/finance'
import { cn, monthKey, todayISO } from './lib/utils'
import { useStore } from './store'
import { COMPANIES } from './types'

export type Tab = 'inicio' | 'pagar' | 'receber' | 'fluxo' | 'ajustes'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'inicio', label: 'Início', icon: LayoutDashboard },
  { id: 'pagar', label: 'A pagar', icon: ArrowUpCircle },
  { id: 'receber', label: 'A receber', icon: ArrowDownCircle },
  { id: 'fluxo', label: 'Fluxo', icon: LineChart },
  { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon },
]

const PAGE_TITLE: Record<Tab, string> = {
  inicio: 'Visão geral',
  pagar: 'Contas a pagar',
  receber: 'Contas a receber',
  fluxo: 'Fluxo de caixa',
  ajustes: 'Ajustes',
}

export default function App() {
  const { company } = useStore()
  const [tab, setTab] = useState<Tab>('inicio')
  const [month, setMonth] = useState(() => (monthKey(todayISO()) > FIRST_MONTH ? monthKey(todayISO()) : FIRST_MONTH))

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col text-slate-900 dark:text-slate-100">
      <header className="sticky-top sticky z-20 bg-slate-900 text-white shadow-md">
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold leading-tight">{PAGE_TITLE[tab]}</h1>
            <SyncStatus />
          </div>
          <p className="truncate text-xs text-slate-400">
            {company === 'todas' ? 'Consolidado das duas empresas' : COMPANIES[company].name}
          </p>
          <div className="mt-3">
            <CompanySelector />
            {(tab === 'inicio' || tab === 'pagar' || tab === 'receber') && (
              <div className="mt-2">
                <MonthNav month={month} onChange={setMonth} />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        {tab === 'inicio' && <Dashboard month={month} onNavigate={setTab} />}
        {tab === 'pagar' && <Contas key="pagar" type="pagar" month={month} />}
        {tab === 'receber' && <Contas key="receber" type="receber" month={month} />}
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
  const { syncState, lastSync } = useStore()
  const hora = lastSync ? new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
  const map = {
    desconectado: { icon: HardDrive, label: 'Salvo no celular', cls: 'text-slate-400' },
    sincronizando: { icon: RefreshCw, label: 'Sincronizando…', cls: 'text-slate-300' },
    sincronizado: { icon: Cloud, label: `Sincronizado ${hora}`, cls: 'text-slate-300' },
    offline: { icon: CloudOff, label: 'Offline · salvo no celular', cls: 'text-amber-300' },
    erro: { icon: CloudOff, label: 'Falha ao sincronizar', cls: 'text-red-300' },
  }[syncState]
  const Icon = map.icon
  return (
    <span className={cn('flex shrink-0 items-center gap-1 text-[11px]', map.cls)}>
      <Icon className={cn('h-3.5 w-3.5', syncState === 'sincronizando' && 'animate-spin')} /> {map.label}
    </span>
  )
}
