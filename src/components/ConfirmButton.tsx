import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'

/** Botão de ação perigosa: o primeiro toque pede confirmação, o segundo executa. */
export default function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Toque de novo para confirmar',
  className,
}: {
  onConfirm: () => void
  children: ReactNode
  confirmLabel?: string
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={cn('btn bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', armed && 'bg-red-600 text-white dark:bg-red-600 dark:text-white', className)}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
