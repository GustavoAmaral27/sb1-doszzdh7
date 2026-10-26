import type { Transaction } from '../types'
import { monthKey, statusOf, sum, todayISO } from './utils'

/** Primeiro mês acompanhado no app. */
export const FIRST_MONTH = '2026-11'

export interface MonthSummary {
  receber: number
  recebido: number
  pagar: number
  pago: number
  /** Resultado previsto: tudo que vence no mês (a receber − a pagar). */
  previsto: number
  /** Resultado realizado: o que já foi recebido − o que já foi pago. */
  realizado: number
  vencidoReceber: number
  vencidoPagar: number
  qtdVencidoReceber: number
  qtdVencidoPagar: number
}

/** Movimentação do mês, pelo vencimento de cada lançamento. */
export function summarizeMonth(list: Transaction[], month: string, today = todayISO()): MonthSummary {
  const inMonth = list.filter((t) => monthKey(t.dueDate) === month)
  const rec = inMonth.filter((t) => t.type === 'receber')
  const pag = inMonth.filter((t) => t.type === 'pagar')
  const vR = rec.filter((t) => statusOf(t, today) === 'vencido')
  const vP = pag.filter((t) => statusOf(t, today) === 'vencido')
  const recebido = sum(rec.filter((t) => t.paid))
  const pago = sum(pag.filter((t) => t.paid))
  return {
    receber: sum(rec),
    recebido,
    pagar: sum(pag),
    pago,
    previsto: sum(rec) - sum(pag),
    realizado: recebido - pago,
    vencidoReceber: sum(vR),
    vencidoPagar: sum(vP),
    qtdVencidoReceber: vR.length,
    qtdVencidoPagar: vP.length,
  }
}

/** Valor com sinal: entrada positiva, saída negativa. */
export const signed = (t: Transaction) => (t.type === 'receber' ? t.amount : -t.amount)

/** Data em que o lançamento afeta o caixa: pagamento (realizado) ou vencimento (previsto). */
export const cashDate = (t: Transaction) => (t.paid ? t.paidDate ?? t.dueDate : t.dueDate)
