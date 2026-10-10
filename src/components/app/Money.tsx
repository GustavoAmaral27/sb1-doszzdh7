import { useAuth } from '../../context/AuthContext'
import { formatBRL } from '../../lib/format'
import { cn } from '../../lib/utils'

/** Valor monetário que respeita o "modo privacidade" (oculta números). */
export default function Money({ value, className, signed }: { value: number; className?: string; signed?: 'expense' | 'income' }) {
  const { privacy } = useAuth()
  const prefix = signed === 'expense' ? '− ' : signed === 'income' ? '+ ' : ''
  return (
    <span className={cn('tabular-nums', className)}>
      {privacy ? 'R$ •••••' : prefix + formatBRL(signed ? Math.abs(value) : value)}
    </span>
  )
}
