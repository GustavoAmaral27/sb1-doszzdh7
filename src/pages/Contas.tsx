import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import TransactionForm from '../components/TransactionForm'
import TransactionItem from '../components/TransactionItem'
import { useFiltered } from '../store'
import type { Transaction, TxStatus, TxType } from '../types'
import { cn, monthKey, money, statusOf, sum, todayISO } from '../lib/utils'

type StatusFilter = 'aberto' | 'vencido' | 'pago' | 'todos'

export default function Contas({ type, month }: { type: TxType; month: string }) {
  const all = useFiltered()
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ editing?: Transaction } | null>(null)
  const isPagar = type === 'pagar'

  // Só os lançamentos do tipo e do mês escolhido no topo (pelo vencimento).
  const ofType = useMemo(() => all.filter((t) => t.type === type && monthKey(t.dueDate) === month), [all, type, month])
  const today = todayISO()

  const totals = useMemo(() => {
    const by = (s: TxStatus) => ofType.filter((t) => statusOf(t, today) === s)
    return {
      aberto: sum(by('pendente')) + sum(by('vencido')),
      vencido: sum(by('vencido')),
      pagoMes: sum(by('pago')),
    }
  }, [ofType, today])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ofType
      .filter((t) => {
        const s = statusOf(t, today)
        if (status === 'aberto' && s === 'pago') return false
        if (status === 'vencido' && s !== 'vencido') return false
        if (status === 'pago' && s !== 'pago') return false
        if (q && ![t.description, t.party, t.category, t.notes ?? ''].some((f) => f.toLowerCase().includes(q))) return false
        return true
      })
      .sort((a, b) => (status === 'pago' ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate)))
  }, [ofType, status, query, today])

  const STATUS: { id: StatusFilter; label: string }[] = [
    { id: 'aberto', label: 'Em aberto' },
    { id: 'vencido', label: 'Vencidas' },
    { id: 'pago', label: isPagar ? 'Pagas' : 'Recebidas' },
    { id: 'todos', label: 'Todas' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Em aberto" value={totals.aberto} />
        <Mini label="Vencido" value={totals.vencido} alert={totals.vencido > 0} />
        <Mini label={isPagar ? 'Pago' : 'Recebido'} value={totals.pagoMes} />
      </div>

      <div className="card space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar descrição, cliente, categoria…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {STATUS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
              className={cn(
                'truncate rounded-full px-1 py-1.5 text-[13px] font-medium',
                status === s.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card py-1">
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Nenhuma conta aqui.
            <br />
            Toque em <b>Nova</b> para lançar.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((t) => (
                <TransactionItem key={t.id} t={t} onEdit={(editing) => setForm({ editing })} />
              ))}
            </ul>
            <div className="flex justify-between border-t border-slate-200 py-3 text-sm font-semibold dark:border-slate-700">
              <span>{list.length} lançamento(s)</span>
              <span className="tabular-nums">{money(sum(list))}</span>
            </div>
          </>
        )}
      </div>

      {/* Botão fixo para lançar: não some ao rolar a lista. */}
      <button
        onClick={() => setForm({})}
        aria-label={isPagar ? 'Nova conta a pagar' : 'Nova conta a receber'}
        className="fab fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg active:scale-95"
      >
        <Plus className="h-7 w-7" />
      </button>

      {form && <TransactionForm type={type} month={month} editing={form.editing} onClose={() => setForm(null)} />}
    </div>
  )
}

function Mini({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={cn('card p-3', alert && 'ring-red-300 dark:ring-red-900')}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 text-sm font-bold tabular-nums', alert && 'text-red-700 dark:text-red-400')}>{money(value)}</p>
    </div>
  )
}
