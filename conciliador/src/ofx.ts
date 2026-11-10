import type { BankStatement, BankTxn } from './types.ts'
import { parseMoney } from './util.ts'

const tag = (block: string, name: string) =>
  new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block)?.[1].trim() ?? ''

const ofxDate = (s: string) => (/^\d{8}/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '')

/** Lê um extrato OFX (o formato que todo banco brasileiro exporta). Um arquivo pode trazer várias contas. */
export function parseOfx(buf: Buffer): BankStatement[] {
  let text = buf.toString('utf8')
  if (text.includes('�')) text = buf.toString('latin1')
  const statements: BankStatement[] = []
  for (const block of text.split(/<STMTRS>|<CCSTMTRS>/i).slice(1)) {
    const txns: BankTxn[] = []
    const seen = new Map<string, number>()
    for (const t of block.split(/<STMTTRN>/i).slice(1)) {
      const body = t.split(/<\/STMTTRN>/i)[0]
      const date = ofxDate(tag(body, 'DTPOSTED'))
      const amount = parseMoney(tag(body, 'TRNAMT'))
      if (!date || amount === null || amount === 0) continue
      const memo = [tag(body, 'NAME'), tag(body, 'MEMO')].filter(Boolean).join(' ').replace(/\s+/g, ' ')
      // Alguns bancos repetem ou omitem o FITID; a chave precisa ser única e estável entre execuções.
      const base = `${tag(body, 'FITID') || memo}|${date}|${amount}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      txns.push({ id: n > 1 ? `${base}#${n}` : base, date, amount, memo })
    }
    const dates = txns.map((t) => t.date).sort()
    statements.push({
      bankId: tag(block, 'BANKID'),
      acctId: tag(block, 'ACCTID'),
      start: ofxDate(tag(block, 'DTSTART')) || dates[0] || '',
      end: ofxDate(tag(block, 'DTEND')) || dates[dates.length - 1] || '',
      balance: /<LEDGERBAL>/i.test(block)
        ? (parseMoney(tag(block.split(/<LEDGERBAL>/i)[1], 'BALAMT')) ?? undefined)
        : undefined,
      txns,
    })
  }
  return statements
}
