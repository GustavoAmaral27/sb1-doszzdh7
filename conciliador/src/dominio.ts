import type { NewEntry } from './types.ts'
import { brDate, brMoney, onlyDigits } from './util.ts'

/**
 * Gera o arquivo de importação do Domínio no "Leiaute Domínio Sistemas com Separador":
 *   |0000|CNPJ|
 *   |6000|X||||                      um lote por lançamento, X = um débito para um crédito
 *   |6100|data|débito|crédito|valor|cód. histórico|histórico|usuário|filial|SCP|
 * No Domínio: Utilitários > Importação > Importação Padrão > Lançamentos Contábeis em Lote.
 * O Domínio lê o arquivo em ANSI, por isso o retorno é um Buffer em latin1.
 */
export function buildDominioTxt(cnpj: string, entries: NewEntry[]): Buffer {
  const lines = [`|0000|${onlyDigits(cnpj)}|`]
  for (const e of entries) {
    lines.push('|6000|X||||')
    lines.push(`|6100|${brDate(e.date)}|${e.debit}|${e.credit}|${brMoney(e.amount)}||${cleanHistory(e.history)}||||`)
  }
  return Buffer.from(lines.join('\r\n') + '\r\n', 'latin1')
}

/** Tira o separador e tudo que o ANSI não representa; o histórico do Domínio é em maiúsculas. */
const cleanHistory = (h: string) =>
  h
    .replace(/[|\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7e -ÿ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 250)
