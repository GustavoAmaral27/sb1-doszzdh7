import {
  Car, Circle, GraduationCap, HeartPulse, Home, PartyPopper, PlusCircle, Receipt, Repeat,
  ShoppingBag, ShoppingCart, TrendingUp, Utensils, Wallet, type LucideIcon,
} from 'lucide-react'
import type { Category } from '../../lib/types'

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, 'shopping-cart': ShoppingCart, car: Car, home: Home, 'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap, 'party-popper': PartyPopper, repeat: Repeat, 'shopping-bag': ShoppingBag,
  receipt: Receipt, circle: Circle, wallet: Wallet, 'trending-up': TrendingUp, 'plus-circle': PlusCircle,
}

export default function CategoryIcon({ category, size = 'md' }: { category?: Category; size?: 'sm' | 'md' }) {
  const Icon = ICONS[category?.icon ?? 'circle'] ?? Circle
  const color = category?.color ?? '#94a3b8'
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  return (
    <span className={`${box} grid shrink-0 place-items-center rounded-full`} style={{ backgroundColor: `${color}1f`, color }}>
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden />
    </span>
  )
}
