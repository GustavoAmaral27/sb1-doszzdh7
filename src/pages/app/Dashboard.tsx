import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, CreditCard, Landmark, MessageCircle, Wallet } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'
import { formatDate, monthStart } from '../../lib/format'
import Money from '../../components/app/Money'
import CategoryIcon from '../../components/app/CategoryIcon'
import { Card, Empty } from '../../components/app/ui'

export default function Dashboard() {
  const { accounts, transactions, categoryById, budgets, loading } = useFinance()

  const stats = useMemo(() => {
    const start = monthStart()
    const month = transactions.filter((t) => t.occurred_on >= start)
    const expenses = month.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
    const income = month.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0)
    const byCat = new Map<string | null, number>()
    for (const t of month) if (t.kind === 'expense') byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount)
    const top = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 6)

    // Gastos por mês (últimos 6)
    const months: { label: string; expense: number; income: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const rows = transactions.filter((t) => t.occurred_on.startsWith(key))
      months.push({
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        expense: rows.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0),
        income: rows.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0),
      })
    }
    return { expenses, income, top, months, monthRows: month }
  }, [transactions])

  const bankBalance = accounts.filter((a) => a.type !== 'credit_card').reduce((s, a) => s + a.balance, 0)
  const cards = accounts.filter((a) => a.type === 'credit_card')
  const cardBill = cards.reduce((s, a) => s + a.balance, 0)
  const maxMonth = Math.max(1, ...stats.months.flatMap((m) => [m.expense, m.income]))
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  if (loading) return <div className="grid h-64 place-items-center text-slate-400">Carregando…</div>

  return (
    <div className="space-y-6">
      {/* Destaque principal */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white shadow-lg md:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <p className="text-sm text-emerald-100">Saldo em contas</p>
        <Money value={bankBalance} className="mt-1 block text-4xl font-bold tracking-tight" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:max-w-lg">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="flex items-center gap-1 text-xs text-emerald-100"><ArrowUpRight className="h-3.5 w-3.5" /> Receitas em {monthName}</p>
            <Money value={stats.income} className="mt-1 block font-semibold" />
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="flex items-center gap-1 text-xs text-emerald-100"><ArrowDownRight className="h-3.5 w-3.5" /> Gastos em {monthName}</p>
            <Money value={stats.expenses} className="mt-1 block font-semibold" />
          </div>
        </div>
        <Link
          to="/assessor"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow hover:bg-emerald-50"
        >
          <MessageCircle className="h-4 w-4" /> Falar com o assessor
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Onde você gastou */}
        <Card className="lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Onde você gastou em {monthName}</h2>
          {stats.top.length === 0 ? (
            <Empty icon={<Wallet className="h-6 w-6" />} title="Nenhum gasto ainda">
              Mande "gastei 25 no almoço" para o assessor ou conecte seu banco.
            </Empty>
          ) : (
            <ul className="mt-4 space-y-4">
              {stats.top.map(([catId, value]) => {
                const cat = categoryById(catId)
                const budget = budgets.find((b) => b.category_id === catId)
                const pct = (value / stats.expenses) * 100
                return (
                  <li key={catId ?? 'none'} className="flex items-center gap-3">
                    <CategoryIcon category={cat} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-800">{cat?.name ?? 'Sem categoria'}</span>
                        <Money value={value} className="font-semibold text-slate-900" />
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat?.color ?? '#94a3b8' }} />
                      </div>
                      {budget && (
                        <p className={`mt-1 text-xs ${value > budget.monthly_limit ? 'text-red-600' : 'text-slate-500'}`}>
                          {Math.round((value / budget.monthly_limit) * 100)}% do orçamento
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Cartões */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Cartões de crédito</h2>
            <Link to="/contas" className="text-xs font-semibold text-emerald-700 hover:underline">Ver todos</Link>
          </div>
          {cards.length === 0 ? (
            <Empty icon={<CreditCard className="h-6 w-6" />} title="Nenhum cartão conectado">
              <Link to="/contas" className="font-semibold text-emerald-700">Conectar pelo Open Finance</Link>
            </Empty>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-500">Faturas abertas</p>
              <Money value={cardBill} className="text-2xl font-bold text-slate-900" />
              <ul className="mt-4 space-y-3">
                {cards.map((c) => {
                  const used = c.credit_limit ? (c.balance / c.credit_limit) * 100 : 0
                  return (
                    <li key={c.id} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-800">{c.name}</span>
                        <Money value={c.balance} className="font-semibold" />
                      </div>
                      {c.credit_limit ? (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full rounded-full ${used > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, used)}%` }} />
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-xs text-slate-500">
                        {c.number_masked} {c.bill_due_day ? `· vence dia ${c.bill_due_day}` : ''}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Evolução */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Últimos 6 meses</h2>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Receitas</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-800" /> Gastos</span>
            </div>
          </div>
          <div className="mt-6 flex h-44 items-end justify-between gap-2" role="img" aria-label="Receitas e gastos por mês">
            {stats.months.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div className="w-3 rounded-t bg-emerald-500 md:w-5" style={{ height: `${(m.income / maxMonth) * 100}%` }} title="Receitas" />
                  <div className="w-3 rounded-t bg-slate-800 md:w-5" style={{ height: `${(m.expense / maxMonth) * 100}%` }} title="Gastos" />
                </div>
                <span className="text-xs capitalize text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Últimas transações */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Últimas movimentações</h2>
            <Link to="/transacoes" className="text-xs font-semibold text-emerald-700 hover:underline">Ver todas</Link>
          </div>
          {transactions.length === 0 ? (
            <Empty icon={<Landmark className="h-6 w-6" />} title="Sem movimentações" />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {transactions.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <CategoryIcon category={categoryById(t.category_id)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{t.description}</p>
                    <p className="text-xs text-slate-500">{formatDate(t.occurred_on)}</p>
                  </div>
                  <Money value={t.amount} signed={t.kind} className={`text-sm font-semibold ${t.kind === 'income' ? 'text-emerald-600' : 'text-slate-900'}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
