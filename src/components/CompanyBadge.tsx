import { COMPANIES, type CompanyId } from '../types'
import { cn } from '../lib/utils'

export default function CompanyBadge({ id, className }: { id: CompanyId; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', COMPANIES[id].dot)} />
      {COMPANIES[id].short}
    </span>
  )
}
