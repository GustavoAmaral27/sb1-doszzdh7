import type { BankStatement, CompanyConfig, Issue, LedgerAccount, LedgerEntry, NewEntry } from './types.ts'
import { closingBalance } from './razao.ts'
import { brDate, brMoney, daysBetween } from './util.ts'

export interface BankResult {
  matched: number
  entries: NewEntry[]
  issues: Issue[]
}

/**
 * Cruza o extrato com a conta contábil do banco.
 * - Movimento do extrato que já está na contabilidade (mesmo valor, data dentro da janela): conciliado.
 * - Movimento só no extrato: vira lançamento, com a contrapartida da primeira regra que casar
 *   ou, sem regra, a conta transitória.
 * - Lançamento só na contabilidade: pendência (o sistema nunca estorna nada sozinho).
 */
export function reconcileBank(
  stmt: BankStatement,
  account: LedgerAccount,
  cfg: CompanyConfig,
  alreadySent: ReadonlySet<string>,
): BankResult {
  const window = cfg.dateWindowDays ?? 3
  const issues: Issue[] = []
  const entries: NewEntry[] = []
  const free = new Set<LedgerEntry>(account.entries)
  // No razão, entrada de dinheiro é débito na conta do banco.
  const signed = (e: LedgerEntry) => e.debit - e.credit

  const take = (amount: number, date: string, maxDays: number) => {
    let best: LedgerEntry | undefined
    let bestGap = Infinity
    for (const e of free) {
      if (signed(e) !== amount) continue
      const gap = Math.abs(daysBetween(e.date, date))
      if (gap <= maxDays && gap < bestGap) (best = e), (bestGap = gap)
    }
    if (best) free.delete(best)
    return best
  }

  // Primeiro todos os casamentos de mesma data; só depois os de data próxima,
  // para um movimento não "roubar" o par exato de outro.
  const pending = stmt.txns.filter((t) => !take(t.amount, t.date, 0))
  const unmatched = pending.filter((t) => !take(t.amount, t.date, window))
  const matched = stmt.txns.length - unmatched.length

  let sentBefore = 0
  for (const t of unmatched) {
    const key = `${stmt.bankId}|${stmt.acctId}|${t.id}`
    if (alreadySent.has(key)) {
      // Já foi gerado numa execução anterior e o razão ainda não reflete a importação.
      sentBefore += t.amount
      continue
    }
    const direction = t.amount > 0 ? 'entrada' : 'saida'
    const rule = cfg.rules?.find(
      (r) => (!r.direction || r.direction === direction) && new RegExp(r.match, 'i').test(t.memo),
    )
    const other = rule?.account ?? cfg.transitAccount
    entries.push({
      key,
      date: t.date,
      debit: t.amount > 0 ? account.code : other,
      credit: t.amount > 0 ? other : account.code,
      amount: Math.abs(t.amount),
      history: t.memo || (t.amount > 0 ? 'CREDITO EM CONTA' : 'DEBITO EM CONTA'),
      classified: !!rule,
    })
    if (!rule)
      issues.push({
        kind: 'sem_regra',
        account: account.code,
        date: t.date,
        amount: t.amount,
        detail: `Sem regra para "${t.memo}": lançado na conta transitória ${cfg.transitAccount}`,
      })
  }

  for (const e of free) {
    if (e.date < stmt.start || e.date > stmt.end) continue
    issues.push({
      kind: 'contabil_sem_extrato',
      account: account.code,
      date: e.date,
      amount: signed(e),
      detail: `Lançado na contabilidade e não encontrado no extrato: ${e.history}`,
    })
  }

  if (stmt.balance !== undefined) {
    const lastDate = account.entries.reduce((d, e) => (e.date > d ? e.date : d), '')
    const expected =
      closingBalance(account) + sentBefore + entries.reduce((s, e) => s + (e.debit === account.code ? e.amount : -e.amount), 0)
    // Só compara se o razão não passa do fim do extrato; senão os saldos são de datas diferentes.
    if (lastDate <= stmt.end && expected !== stmt.balance)
      issues.push({
        kind: 'saldo_banco_diverge',
        account: account.code,
        date: stmt.end,
        amount: expected - stmt.balance,
        detail: `Saldo contábil após a conciliação ${brMoney(expected)} x saldo do banco ${brMoney(stmt.balance)} em ${brDate(stmt.end)}`,
      })
  }

  return { matched, entries, issues }
}

/** Acha a conta contábil de um extrato pelo número da conta (ignorando zeros, traço e dígito separador). */
export function ledgerAccountFor(stmt: BankStatement, cfg: CompanyConfig): string | undefined {
  const clean = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')
  return cfg.bankAccounts.find(
    (b) => clean(b.acctId) === clean(stmt.acctId) && (!b.bankId || clean(b.bankId) === clean(stmt.bankId)),
  )?.ledgerAccount
}
