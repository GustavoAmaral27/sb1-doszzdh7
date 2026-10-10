import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Account, Budget, Category, Connection, Transaction } from '../lib/types'

interface FinanceState {
  loading: boolean
  categories: Category[]
  accounts: Account[]
  connections: Connection[]
  transactions: Transaction[]
  budgets: Budget[]
  reload: () => Promise<void>
  categoryById: (id: string | null) => Category | undefined
}

const FinanceContext = createContext<FinanceState | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])

  const reload = useCallback(async () => {
    const since = new Date()
    since.setMonth(since.getMonth() - 6)
    const [c, a, cn, t, b] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('accounts').select('*').order('type').order('name'),
      supabase.from('bank_connections').select('*').order('created_at'),
      supabase
        .from('transactions')
        .select('*')
        .gte('occurred_on', since.toISOString().slice(0, 10))
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase.from('budgets').select('*'),
    ])
    setCategories(c.data ?? [])
    setAccounts((a.data ?? []).map((x) => ({ ...x, balance: Number(x.balance) })))
    setConnections(cn.data ?? [])
    setTransactions((t.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })))
    setBudgets((b.data ?? []).map((x) => ({ ...x, monthly_limit: Number(x.monthly_limit) })))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const categoryById = useCallback((id: string | null) => categories.find((c) => c.id === id), [categories])

  return (
    <FinanceContext.Provider value={{ loading, categories, accounts, connections, transactions, budgets, reload, categoryById }}>
      {children}
    </FinanceContext.Provider>
  )
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance fora do FinanceProvider')
  return ctx
}
