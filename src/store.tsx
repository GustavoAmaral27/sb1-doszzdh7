import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CompanyFilter, Settings, Transaction } from './types'

const TX_KEY = 'financeiro:transacoes'
const SETTINGS_KEY = 'financeiro:config'
const FILTER_KEY = 'financeiro:empresa'

/** Coleção e documento no banco do claude.ai (quando publicado como Artifact). */
const TX_COLLECTION = 'lancamentos'
const SETTINGS_DOC = 'config/geral'

const defaultSettings: Settings = { initialBalance: { ztec: 0, amaral: 0 } }

/** nuvem = salvo na conta Claude; local = salvo só neste aparelho */
export type StorageMode = 'carregando' | 'nuvem' | 'local'

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

/** Remove campos undefined (o banco só aceita JSON puro). */
const plain = (v: object) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>

function toTransaction(id: string, d: Record<string, unknown>): Transaction | null {
  if (typeof d.amount !== 'number' || typeof d.dueDate !== 'string') return null
  if (d.company !== 'ztec' && d.company !== 'amaral') return null
  if (d.type !== 'pagar' && d.type !== 'receber') return null
  return {
    id,
    company: d.company,
    type: d.type,
    description: String(d.description ?? ''),
    category: String(d.category ?? ''),
    party: String(d.party ?? ''),
    amount: d.amount,
    dueDate: d.dueDate,
    paid: d.paid === true,
    paidDate: typeof d.paidDate === 'string' ? d.paidDate : undefined,
    notes: typeof d.notes === 'string' ? d.notes : undefined,
    createdAt: String(d.createdAt ?? ''),
  }
}

function toSettings(d: Record<string, unknown> | undefined): Settings {
  const ib = (d?.initialBalance ?? {}) as Record<string, unknown>
  return {
    initialBalance: {
      ztec: typeof ib.ztec === 'number' ? ib.ztec : 0,
      amaral: typeof ib.amaral === 'number' ? ib.amaral : 0,
    },
  }
}

interface Store {
  transactions: Transaction[]
  settings: Settings
  company: CompanyFilter
  mode: StorageMode
  error: string
  setCompany: (c: CompanyFilter) => void
  addMany: (list: Transaction[]) => void
  update: (t: Transaction) => void
  remove: (id: string) => void
  togglePaid: (id: string, paidDate?: string) => void
  setSettings: (s: Settings) => void
  replaceAll: (data: { transactions: Transaction[]; settings?: Settings }) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const hasBridge = typeof window !== 'undefined' && !!window.claude
  const [mode, setMode] = useState<StorageMode>(hasBridge ? 'carregando' : 'local')
  const [transactions, setTransactions] = useState<Transaction[]>(() => (hasBridge ? [] : load(TX_KEY, [])))
  const [settings, setSettingsState] = useState<Settings>(() => (hasBridge ? defaultSettings : toSettings(load(SETTINGS_KEY, defaultSettings) as never)))
  const [company, setCompany] = useState<CompanyFilter>(() => load(FILTER_KEY, 'todas'))
  const [error, setError] = useState('')
  const dbRef = useRef<ClaudeDb | null>(null)

  // Conecta ao banco do claude.ai uma única vez; sem ele, usa o armazenamento do aparelho.
  useEffect(() => {
    if (!window.claude) return
    let unsubs: (() => void)[] = []
    let cancelled = false
    window.claude
      .use('db')
      .catch(() => null)
      .then((db) => {
        if (cancelled) return
        if (!db) {
          setTransactions(load(TX_KEY, []))
          setSettingsState(toSettings(load(SETTINGS_KEY, defaultSettings) as never))
          setMode('local')
          return
        }
        dbRef.current = db
        const onErr = () => setError('Sem conexão com a nuvem. Recarregue a página.')
        unsubs = [
          db.collection(TX_COLLECTION).onSnapshot((snap) => {
            setTransactions(snap.docs.map((d) => toTransaction(d.id, d.data() ?? {})).filter((t): t is Transaction => !!t))
            setMode('nuvem')
          }, onErr),
          db.doc(SETTINGS_DOC).onSnapshot((snap) => setSettingsState(toSettings(snap.data())), onErr),
        ]
      })
    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [])

  useEffect(() => {
    if (mode === 'local') save(TX_KEY, transactions)
  }, [transactions, mode])
  useEffect(() => {
    if (mode === 'local') save(SETTINGS_KEY, settings)
  }, [settings, mode])
  useEffect(() => save(FILTER_KEY, company), [company])

  const value = useMemo<Store>(() => {
    const db = mode === 'nuvem' ? dbRef.current : null
    const fail = () => setError('Não foi possível salvar na nuvem. Verifique a internet e tente de novo.')
    const write = (t: Transaction) => db?.collection(TX_COLLECTION).doc(t.id).set(plain(t)).catch(fail)
    const del = (id: string) => db?.collection(TX_COLLECTION).doc(id).delete().catch(fail)

    return {
      transactions,
      settings,
      company,
      mode,
      error,
      setCompany,
      setSettings: (s) => {
        if (db) db.doc(SETTINGS_DOC).set(plain(s)).catch(fail)
        setSettingsState(s)
      },
      addMany: (list) => {
        if (db) list.forEach(write)
        else setTransactions((prev) => [...prev, ...list])
      },
      update: (t) => {
        if (db) write(t)
        else setTransactions((prev) => prev.map((p) => (p.id === t.id ? t : p)))
      },
      remove: (id) => {
        if (db) del(id)
        else setTransactions((prev) => prev.filter((p) => p.id !== id))
      },
      togglePaid: (id, paidDate) => {
        const t = transactions.find((p) => p.id === id)
        if (!t) return
        const next = { ...t, paid: !t.paid, paidDate: t.paid ? undefined : paidDate ?? t.dueDate }
        if (db) write(next)
        else setTransactions((prev) => prev.map((p) => (p.id === id ? next : p)))
      },
      replaceAll: async (data) => {
        if (db) {
          const keep = new Set(data.transactions.map((t) => t.id))
          for (const t of transactions) if (!keep.has(t.id)) await del(t.id)
          for (const t of data.transactions) await write(t)
          if (data.settings) await db.doc(SETTINGS_DOC).set(plain(data.settings)).catch(fail)
        } else {
          setTransactions(data.transactions)
          if (data.settings) setSettingsState(toSettings(data.settings as never))
        }
      },
    }
  }, [transactions, settings, company, mode, error])

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
