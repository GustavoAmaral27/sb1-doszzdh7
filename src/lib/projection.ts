import type { Transaction } from '../types'
import { FIRST_MONTH, LAST_MONTH } from './finance'
import { monthKey, shiftMonth } from './utils'

export interface ProjectionMonth {
  month: string
  /** Receitas − despesas com vencimento no mês. */
  resultado: number
  /** Juros ganhos no mês sobre o que estava aplicado. */
  rendimento: number
  /** Total aplicado no fim do mês (já com juros). */
  aplicado: number
  /** Parte do resultado que ficou parada, sem render. */
  livre: number
  /** Disponível total aplicando (aplicado + livre). */
  comAplicacao: number
  /** Disponível total se nada fosse aplicado. */
  semAplicacao: number
}

/**
 * Mês a mês: o saldo aplicado rende `taxaMes` (juros compostos), recebe `pctAplicado`
 * do resultado positivo do mês e banca os meses negativos. O resto fica livre, sem render.
 * Valores brutos (sem IR).
 */
export function project(list: Transaction[], saldoInicial: number, taxaMes: number, pctAplicado: number): ProjectionMonth[] {
  const byMonth = new Map<string, number>()
  for (const t of list) {
    const m = monthKey(t.dueDate)
    if (m < FIRST_MONTH || m > LAST_MONTH) continue
    byMonth.set(m, (byMonth.get(m) ?? 0) + (t.type === 'receber' ? t.amount : -t.amount))
  }
  const out: ProjectionMonth[] = []
  let aplicado = saldoInicial * pctAplicado
  let livre = saldoInicial - aplicado
  let sem = saldoInicial
  for (let m = FIRST_MONTH; m <= LAST_MONTH; m = shiftMonth(m, 1)) {
    const resultado = byMonth.get(m) ?? 0
    const rendimento = aplicado > 0 ? aplicado * taxaMes : 0
    aplicado += rendimento
    if (resultado >= 0) {
      aplicado += resultado * pctAplicado
      livre += resultado * (1 - pctAplicado)
    } else {
      // mês negativo: usa primeiro o dinheiro livre, depois resgata da aplicação
      const doLivre = Math.min(livre, -resultado)
      livre -= doLivre
      aplicado += resultado + doLivre
    }
    sem += resultado
    out.push({ month: m, resultado, rendimento, aplicado, livre, comAplicacao: aplicado + livre, semAplicacao: sem })
  }
  return out
}
