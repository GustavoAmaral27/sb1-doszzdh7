import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { COMPANY_IDS, zeroBalances, type CompanyFilter, type Settings, type Transaction } from './types'
import { supabase } from './lib/supabase'
import { syncAll } from './lib/sync'

const TX_KEY = 'financeiro:transacoes'
const SETTINGS_KEY = 'financeiro:config'
const FILTER_KEY = 'financeiro:empresa'
const LAST_SYNC_KEY = 'financeiro:ultima-sincronizacao'

const defaultSettings: Settings = { initialBalance: zeroBalances() }

/** offline = sem internet; desconectado = sem login; erro = falhou a última tentativa */
export type SyncState = 'desconectado' | 'sincronizando' | 'sincronizado' | 'offline' | 'erro'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* armazenamento indisponível */
  }
}

const now = () => new Date().toISOString()

/** Garante saldo inicial para todas as empresas (configs antigas só tinham Z-TEC e Amaral). */
function withAllCompanies(s: Partial<Settings> | undefined): Settings {
  return { ...s, initialBalance: { ...zeroBalances(), ...(s?.initialBalance ?? {}) } }
}

interface Store {
  /** Lançamentos visíveis (sem os excluídos). */
  transactions: Transaction[]
  settings: Settings
  company: CompanyFilter
  setCompany: (c: CompanyFilter) => void
  addMany: (list: Transaction[]) => void
  update: (t: Transaction) => void
  remove: (id: string) => void
  togglePaid: (id: string, paidDate?: string) => void
  setSettings: (s: Settings) => void
  replaceAll: (data: { transactions: Transaction[]; settings?: Settings }) => void
  session: Session | null
  syncState: SyncState
  lastSync: string | null
  syncNow: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  // Inclui os excluídos (com deleted: true) para a nuvem saber que foram apagados.
  const [all, setAll] = useState<Transaction[]>(() => load(TX_KEY, []))
  const [settings, setSettingsState] = useState<Settings>(() => (withAllCompanies(load(SETTINGS_KEY, defaultSettings))))
  const [company, setCompany] = useState<CompanyFilter>(() => load(FILTER_KEY, 'todas'))
  const [session, setSession] = useState<Session | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('desconectado')
  const [lastSync, setLastSync] = useState<string | null>(() => load(LAST_SYNC_KEY, null))

  useEffect(() => save(TX_KEY, all), [all])
  useEffect(() => save(SETTINGS_KEY, settings), [settings])
  useEffect(() => save(FILTER_KEY, company), [company])

  // Referências para a sincronização sempre ler o estado mais novo.
  const allRef = useRef(all)
  const settingsRef = useRef(settings)
  allRef.current = all
  settingsRef.current = settings
  const running = useRef(false)
  const again = useRef(false)

  const syncNow = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const s = data.session
    if (!s) return setSyncState('desconectado')
    if (!navigator.onLine) return setSyncState('offline')
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    setSyncState('sincronizando')
    try {
      const sentAll = allRef.current
      const sentSettings = settingsRef.current
      const res = await syncAll(sentAll, sentSettings, s.user.id)
      // Se algo mudou no celular durante a sincronização, mantém a mudança e envia na próxima rodada.
      setAll((cur) => {
        if (cur === sentAll) return res.transactions
        const merged = new Map(res.transactions.map((t) => [t.id, t]))
        const sent = new Map(sentAll.map((t) => [t.id, t]))
        for (const t of cur) if (sent.get(t.id) !== t) merged.set(t.id, t)
        again.current = true
        return [...merged.values()]
      })
      setSettingsState((cur) => (cur === sentSettings ? res.settings : cur))
      const at = now()
      setLastSync(at)
      save(LAST_SYNC_KEY, at)
      setSyncState('sincronizado')
    } catch {
      setSyncState(navigator.onLine ? 'erro' : 'offline')
    } finally {
      running.current = false
      if (again.current) {
        again.current = false
        setTimeout(syncNow, 500)
      }
    }
  }, [])

  // Sessão de login (fica salva no celular; funciona offline).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) syncNow()
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN') syncNow()
      if (event === 'SIGNED_OUT') setSyncState('desconectado')
    })
    return () => data.subscription.unsubscribe()
  }, [syncNow])

  // Sincroniza ao voltar a internet, ao reabrir o app e a cada minuto com o app aberto.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && syncNow()
    const onOffline = () => setSyncState((s) => (s === 'desconectado' ? s : 'offline'))
    window.addEventListener('online', syncNow)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => document.visibilityState === 'visible' && syncNow(), 60_000)
    return () => {
      window.removeEventListener('online', syncNow)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [syncNow])

  // Depois de cada alteração, envia para a nuvem (agrupando alterações seguidas).
  const pending = useRef<ReturnType<typeof setTimeout>>()
  const scheduleSync = useCallback(() => {
    clearTimeout(pending.current)
    pending.current = setTimeout(syncNow, 1500)
  }, [syncNow])

  const value = useMemo<Store>(() => {
    const change = (fn: (prev: Transaction[]) => Transaction[]) => {
      setAll(fn)
      scheduleSync()
    }
    return {
      transactions: all.filter((t) => !t.deleted),
      settings,
      company,
      setCompany,
      session,
      syncState,
      lastSync,
      syncNow,
      setSettings: (s) => {
        setSettingsState({ ...s, updatedAt: now() })
        scheduleSync()
      },
      addMany: (list) =>
        change((prev) => {
          const added = new Map(list.map((t) => [t.id, { ...t, updatedAt: now(), deleted: false }]))
          return [...prev.filter((p) => !added.has(p.id)), ...added.values()]
        }),
      update: (t) => change((prev) => prev.map((p) => (p.id === t.id ? { ...t, updatedAt: now() } : p))),
      remove: (id) => change((prev) => prev.map((p) => (p.id === id ? { ...p, deleted: true, updatedAt: now() } : p))),
      togglePaid: (id, paidDate) =>
        change((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, paid: !p.paid, paidDate: p.paid ? undefined : paidDate ?? p.dueDate, updatedAt: now() }
              : p,
          ),
        ),
      replaceAll: (data) => {
        const t = now()
        const keep = new Set(data.transactions.map((x) => x.id))
        change((prev) => [
          ...prev.filter((p) => !keep.has(p.id)).map((p) => ({ ...p, deleted: true, updatedAt: t })),
          ...data.transactions.map((x) => ({ ...x, deleted: false, updatedAt: t })),
        ])
        if (data.settings) setSettingsState({ ...withAllCompanies(data.settings), updatedAt: t })
      },
    }
  }, [all, settings, company, session, syncState, lastSync, syncNow, scheduleSync])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}

/** Lançamentos filtrados pela empresa selecionada ("todas" = soma de todas). */
export function useFiltered() {
  const { transactions, company } = useStore()
  return useMemo(
    () => (company === 'todas' ? transactions : transactions.filter((t) => t.company === company)),
    [transactions, company],
  )
}

export function useInitialBalance() {
  const { settings, company } = useStore()
  return company === 'todas'
    ? COMPANY_IDS.reduce((acc, id) => acc + (settings.initialBalance[id] ?? 0), 0)
    : settings.initialBalance[company] ?? 0
}
