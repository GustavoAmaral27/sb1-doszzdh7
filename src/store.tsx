import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CompanyFilter, Settings, Transaction } from './types'

const TX_KEY = 'financeiro:transacoes'
const SETTINGS_KEY = 'financeiro:config'
const FILTER_KEY = 'financeiro:empresa'

const defaultSettings: Settings = { initialBalance: { ztec: 0, amaral: 0 } }

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

interface Store {
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
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(() => load(TX_KEY, []))
  const [settings, setSettings] = useState<Settings>(() => ({ ...defaultSettings, ...load(SETTINGS_KEY, defaultSettings) }))
  const [company, setCompany] = useState<CompanyFilter>(() => load(FILTER_KEY, 'todas'))

  useEffect(() => save(TX_KEY, transactions), [transactions])
  useEffect(() => save(SETTINGS_KEY, settings), [settings])
  useEffect(() => save(FILTER_KEY, company), [company])

  const value = useMemo<Store>(
    () => ({
      transactions,
      settings,
      company,
      setCompany,
      setSettings,
      addMany: (list) => setTransactions((prev) => [...prev, ...list]),
      update: (t) => setTransactions((prev) => prev.map((p) => (p.id === t.id ? t : p))),
      remove: (id) => setTransactions((prev) => prev.filter((p) => p.id !== id)),
      togglePaid: (id, paidDate) =>
        setTransactions((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, paid: !p.paid, paidDate: p.paid ? undefined : paidDate ?? p.dueDate } : p,
          ),
        ),
      replaceAll: (data) => {
        setTransactions(data.transactions)
        if (data.settings) setSettings({ ...defaultSettings, ...data.settings })
      },
    }),
    [transactions, settings, company],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}

/** Lançamentos filtrados pela empresa selecionada ("todas" = soma das duas). */
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
    ? settings.initialBalance.ztec + settings.initialBalance.amaral
    : settings.initialBalance[company]
}
