import { Check, Undo2 } from 'lucide-react'
import CompanyBadge from './CompanyBadge'
import StatusBadge from './StatusBadge'
import { useStore } from '../store'
import type { Transaction } from '../types'
import { cn, fmtDate, money, statusOf, todayISO } from '../lib/utils'

export default function TransactionItem({ t, onEdit }: { t: Transaction; onEdit: (t: Transaction) => void }) {
  const { company, togglePaid } = useStore()
  const status = statusOf(t)
  const isPagar = t.type === 'pagar'

  return (
    <li className="flex items-center gap-3 py-3">
      <button onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold">{t.description}</p>
          <p className="shrink-0 font-bold tabular-nums">
            {isPagar ? '−' : '+'} {money(t.amount)}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <StatusBadge status={status} type={t.type} />
          {company === 'todas' && <CompanyBadge id={t.company} />}
          <span>Venc. {fmtDate(t.dueDate)}</span>
          {t.paid && t.paidDate && <span>· {isPagar ? 'Pago' : 'Recebido'} {fmtDate(t.paidDate)}</span>}
        </div>
        {(t.party || t.category) && (
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {[t.party, t.category].filter(Boolean).join(' · ')}
          </p>
        )}
      </button>
      <button
        onClick={() => togglePaid(t.id, todayISO())}
        aria-label={t.paid ? 'Desfazer baixa' : isPagar ? 'Marcar como pago' : 'Marcar como recebido'}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
          t.paid
            ? 'border-slate-300 text-slate-500 dark:border-slate-600'
            : 'border-green-600 text-green-700 dark:text-green-400',
        )}
      >
        {t.paid ? <Undo2 className="h-4 w-4" /> : <Check className="h-5 w-5" />}
      </button>
    </li>
  )
}
