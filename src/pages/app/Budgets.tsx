import { useMemo, useState } from 'react'
import { PiggyBank, Trash2 } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'
import { supabase } from '../../lib/supabase'
import { monthStart } from '../../lib/format'
import Money from '../../components/app/Money'
import CategoryIcon from '../../components/app/CategoryIcon'
import { Alert, Button, Card, Empty, Input, PageHeader, Select } from '../../components/app/ui'

export default function Budgets() {
  const { budgets, categories, categoryById, transactions, reload } = useFinance()
  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | null>(null)

  const spent = useMemo(() => {
    const start = monthStart()
    const map = new Map<string, number>()
    for (const t of transactions)
      if (t.kind === 'expense' && t.occurred_on >= start && t.category_id) map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount)
    return map
  }, [transactions])

  const available = categories.filter((c) => c.kind === 'expense' && !budgets.some((b) => b.category_id === c.id))
  const totalLimit = budgets.reduce((s, b) => s + b.monthly_limit, 0)
  const totalSpent = budgets.reduce((s, b) => s + (spent.get(b.category_id) ?? 0), 0)

  async function add() {
    const value = Number(limit.replace(/\./g, '').replace(',', '.'))
    if (!categoryId || !(value > 0)) return setError('Escolha a categoria e um limite maior que zero.')
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('budgets').insert({ user_id: auth.user?.id, category_id: categoryId, monthly_limit: value })
    if (error) return setError('Não foi possível salvar.')
    setError(null)
    setCategoryId('')
    setLimit('')
    reload()
  }

  async function remove(id: string) {
    await supabase.from('budgets').delete().eq('id', id)
    reload()
  }

  return (
    <div>
      <PageHeader title="Orçamentos" subtitle="Defina quanto quer gastar por categoria em cada mês." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {budgets.length === 0 ? (
            <Card><Empty icon={<PiggyBank className="h-6 w-6" />} title="Nenhum orçamento">Crie um limite ao lado e acompanhe aqui.</Empty></Card>
          ) : (
            budgets.map((b) => {
              const cat = categoryById(b.category_id)
              const value = spent.get(b.category_id) ?? 0
              const pct = Math.min(100, (value / b.monthly_limit) * 100)
              const over = value > b.monthly_limit
              return (
                <Card key={b.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={cat} />
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{cat?.name}</p>
                      <p className="text-xs text-slate-500">
                        <Money value={value} /> de <Money value={b.monthly_limit} />
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${over ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {over ? 'Estourou' : <>Resta <Money value={b.monthly_limit - value} /></>}
                    </span>
                    <button onClick={() => remove(b.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              )
            })
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <p className="text-sm text-slate-500">Total orçado no mês</p>
            <Money value={totalLimit} className="text-2xl font-bold text-slate-900" />
            <p className="mt-1 text-sm text-slate-500">Gasto até agora: <Money value={totalSpent} className="font-semibold text-slate-800" /></p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold text-slate-900">Novo orçamento</h2>
            {error && <Alert>{error}</Alert>}
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoria">
              <option value="">Categoria…</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input inputMode="decimal" placeholder="Limite mensal (R$)" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Limite" />
            <Button onClick={add} className="w-full">Adicionar</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
