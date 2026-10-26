import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FIRST_MONTH, LAST_MONTH } from '../lib/finance'
import { monthLabel, shiftMonth } from '../lib/utils'

/** Seletor de mês da barra fixa do topo (vai de FIRST_MONTH a LAST_MONTH). */
export default function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-800 p-1">
      <button
        className="rounded-lg p-2 text-slate-200 disabled:opacity-30"
        aria-label="Mês anterior"
        disabled={month <= FIRST_MONTH}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="font-semibold">{monthLabel(month)}</span>
      <button
        className="rounded-lg p-2 text-slate-200 disabled:opacity-30"
        aria-label="Próximo mês"
        disabled={month >= LAST_MONTH}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
