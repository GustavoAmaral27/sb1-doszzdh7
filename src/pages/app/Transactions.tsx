import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeftRight, Landmark, MessageCircle, Plus, Search, Trash2, X } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'
import { supabase } from '../../lib/supabase'
import { formatDate, today } from '../../lib/format'
import type { Kind, Transaction } from '../../lib/types'
import Money from '../../components/app/Money'
import CategoryIcon from '../../components/app/CategoryIcon'
import { Alert, Button, Card, Empty, Input, Label, PageHeader, Select } from '../../components/app/ui'

export default function Transactions() {
  const { transactions, categories, categoryById, accounts, reload } = useFinance()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'' | Kind>('')
  const [cat, setCat] = useState('')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (!month || t.occurred_on.startsWith(month)) &&
          (!kind || t.kind === kind) &&
          (!cat || t.category_id === cat) &&
          (!q || t.description.toLowerCase().includes(q.toLowerCase())),
      ),
    [transactions, month, kind, cat, q],
  )

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) map.set(t.occurred_on, [...(map.get(t.occurred_on) ?? []), t])
    return [...map]
  }, [filtered])

  const totalOut = filtered.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIn = filtered.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0)

  async function changeCategory(t: Transaction, categoryId: string) {
    const { error } = await supabase.from('transactions').update({ category_id: categoryId || null }).eq('id', t.id)
    if (error) setError('Não foi possível alterar a categoria.')
    else reload()
  }

  async function remove(t: Transaction) {
    if (!window.confirm(`Excluir "${t.description}"?`)) return
    const { error } = await supabase.from('transactions').delete().eq('id', t.id)
    if (error) setError('Não foi possível excluir.')
    else reload()
  }

  const sourceIcon = (t: Transaction) =>
    t.source === 'open_finance' ? (
      <Landmark className="h-3 w-3" aria-label="Importada do banco" />
    ) : t.source === 'assessor' ? (
      <MessageCircle className="h-3 w-3" aria-label="Lançada pelo assessor" />
    ) : null

  return (
    <div>
      <PageHeader
        title="Transações"
        subtitle="Tudo o que entrou e saiu, de todas as contas."
        action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Nova transação</Button>}
      />
      {adding && <NewTransaction onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} />}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Buscar" />
          </div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês" />
          <Select value={kind} onChange={(e) => setKind(e.target.value as '' | Kind)} aria-label="Tipo">
            <option value="">Entradas e saídas</option>
            <option value="expense">Só gastos</option>
            <option value="income">Só receitas</option>
          </Select>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-slate-500">Receitas: <Money value={totalIn} className="font-semibold text-emerald-600" /></span>
          <span className="text-slate-500">Gastos: <Money value={totalOut} className="font-semibold text-slate-900" /></span>
        </div>
      </Card>

      <Card className="p-0">
        {groups.length === 0 ? (
          <Empty icon={<ArrowLeftRight className="h-6 w-6" />} title="Nenhuma transação encontrada" />
        ) : (
          groups.map(([date, rows]) => (
            <div key={date}>
              <p className="sticky top-14 bg-slate-50/95 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{formatDate(date)}</p>
              <ul className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <CategoryIcon category={categoryById(t.category_id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{t.description}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        {sourceIcon(t)}
                        <select
                          value={t.category_id ?? ''}
                          onChange={(e) => changeCategory(t, e.target.value)}
                          className="max-w-[10rem] truncate rounded bg-transparent py-0.5 hover:bg-slate-100 focus:outline-none"
                          aria-label="Categoria"
                        >
                          <option value="">Sem categoria</option>
                          {categories.filter((c) => c.kind === t.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {t.account_id && <span className="hidden truncate md:inline">· {accounts.find((a) => a.id === t.account_id)?.name}</span>}
                      </div>
                    </div>
                    <Money value={t.amount} signed={t.kind} className={`text-sm font-semibold ${t.kind === 'income' ? 'text-emerald-600' : 'text-slate-900'}`} />
                    {t.source !== 'open_finance' && (
                      <button onClick={() => remove(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function NewTransaction({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { categories, accounts } = useFinance()
  const [kind, setKind] = useState<Kind>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (!description.trim() || !(value > 0)) return setError('Preencha descrição e um valor maior que zero.')
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('transactions').insert({
      user_id: auth.user?.id,
      description: description.trim().slice(0, 200),
      amount: Math.round(value * 100) / 100,
      kind,
      occurred_on: date,
      category_id: categoryId || null,
      account_id: accountId || null,
      source: 'manual',
    })
    if (error) setError('Não foi possível salvar.')
    else onSaved()
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 md:place-items-center" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 md:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova transação</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button key={k} type="button" onClick={() => { setKind(k); setCategoryId('') }}
              className={`rounded-lg py-2 text-sm font-semibold ${kind === k ? 'bg-white shadow-sm ' + (k === 'expense' ? 'text-slate-900' : 'text-emerald-700') : 'text-slate-500'}`}>
              {k === 'expense' ? 'Gasto' : 'Receita'}
            </button>
          ))}
        </div>
        <div><Label htmlFor="d">Descrição</Label><Input id="d" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="v">Valor (R$)</Label><Input id="v" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} /></div>
          <div><Label htmlFor="dt">Data</Label><Input id="dt" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div><Label htmlFor="c">Categoria</Label>
          <Select id="c" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        {accounts.length > 0 && (
          <div><Label htmlFor="a">Conta (opcional)</Label>
            <Select id="a" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        )}
        <Button type="submit" className="w-full">Salvar</Button>
      </form>
    </div>
  )
}
