import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import type { TxStatus, TxType } from '../types'
import { cn } from '../lib/utils'

export default function StatusBadge({ status, type }: { status: TxStatus; type: TxType }) {
  const map = {
    pago: { label: type === 'pagar' ? 'Pago' : 'Recebido', icon: CheckCircle2, cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    pendente: { label: 'Em aberto', icon: Clock, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    vencido: { label: 'Vencido', icon: AlertTriangle, cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  }[status]
  const Icon = map.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', map.cls)}>
      <Icon className="h-3 w-3" />
      {map.label}
    </span>
  )
}
