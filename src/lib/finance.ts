import type { Transaction } from '../types'
import { monthKey, statusOf, sum, todayISO } from './utils'

export interface Summary {
  caixa: number
  aReceber: number
  aPagar: number
  previsto: number
  recebidoMes: number
  pagoMes: number
  vencidoReceber: number
  vencidoPagar: number
  qtdVencidoReceber: number
  qtdVencidoPagar: number
}

/** Valor com sinal: entrada positiva, saída negativa. */
export const signed = (t: Transaction) => (t.type === 'receber' ? t.amount : -t.amount)

export function summarize(list: Transaction[], initialBalance: number, today = todayISO()): Summary {
  const paid = list.filter((t) => t.paid)
  const open = list.filter((t) => !t.paid)
  const month = monthKey(today)
  const paidThisMonth = paid.filter((t) => t.paidDate && monthKey(t.paidDate) === month)
  const overdue = open.filter((t) => statusOf(t, today) === 'vencido')

  const caixa = initialBalance + paid.reduce((acc, t) => acc + signed(t), 0)
  const aReceber = sum(open.filter((t) => t.type === 'receber'))
  const aPagar = sum(open.filter((t) => t.type === 'pagar'))
  const vR = overdue.filter((t) => t.type === 'receber')
  const vP = overdue.filter((t) => t.type === 'pagar')

  return {
    caixa,
    aReceber,
    aPagar,
    previsto: caixa + aReceber - aPagar,
    recebidoMes: sum(paidThisMonth.filter((t) => t.type === 'receber')),
    pagoMes: sum(paidThisMonth.filter((t) => t.type === 'pagar')),
    vencidoReceber: sum(vR),
    vencidoPagar: sum(vP),
    qtdVencidoReceber: vR.length,
    qtdVencidoPagar: vP.length,
  }
}

/** Data em que o lançamento afeta o caixa: pagamento (realizado) ou vencimento (previsto). */
export const cashDate = (t: Transaction) => (t.paid ? t.paidDate ?? t.dueDate : t.dueDate)
