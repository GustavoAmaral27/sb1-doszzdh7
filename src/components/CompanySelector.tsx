import { useStore } from '../store'
import { COMPANIES, COMPANY_IDS, type CompanyFilter } from '../types'
import { cn } from '../lib/utils'

const OPTIONS: { id: CompanyFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  ...COMPANY_IDS.map((id) => ({ id, label: COMPANIES[id].short })),
]

export default function CompanySelector() {
  const { company, setCompany } = useStore()
  return (
    <div role="radiogroup" aria-label="Empresa" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={company === o.id}
          onClick={() => setCompany(o.id)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition',
            company === o.id ? 'bg-white text-slate-900 shadow' : 'text-slate-300',
          )}
        >
          {o.id !== 'todas' && <span className={cn('h-2 w-2 rounded-full', COMPANIES[o.id].dot)} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
