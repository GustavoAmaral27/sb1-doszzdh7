import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Transaction, TxStatus } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (v: number) => brl.format(v)

export function todayISO() {
  const d = new Date()
  return toISO(d)
}

export function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fmtDate(s?: string) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

/** Soma meses mantendo o dia (ajustando para o último dia do mês quando preciso). */
export function addMonths(iso: string, n: number) {
  const d = parseISO(iso)
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, last))
  return toISO(target)
}

/** "AAAA-MM" */
export const monthKey = (iso: string) => iso.slice(0, 7)

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function monthLabel(key: string, short = false) {
  const [y, m] = key.split('-').map(Number)
  return short ? `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`
}

export function shiftMonth(key: string, n: number) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function statusOf(t: Transaction, today = todayISO()): TxStatus {
  if (t.paid) return 'pago'
  return t.dueDate < today ? 'vencido' : 'pendente'
}

export const sum = (list: Transaction[]) => list.reduce((acc, t) => acc + t.amount, 0)

/** Cor do valor: verde para receita, vermelho para despesa. */
export const amountColor = (type: 'pagar' | 'receber') =>
  type === 'receber' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Converte "1.234,56" ou "1234.56" em número. */
export function parseMoney(s: string) {
  const clean = s.replace(/[^\d,.-]/g, '')
  if (clean.includes(',')) return Number(clean.replace(/\./g, '').replace(',', '.'))
  return Number(clean)
}
