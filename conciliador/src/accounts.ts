import type { AccountComposition, CompanyConfig, Issue, LedgerAccount, LedgerEntry, OpenItem } from './types.ts'
import { closingBalance } from './razao.ts'
import { brDate, brMoney, daysBetween } from './util.ts'

/** Número de documento citado no histórico (NF 1234, DUPL. 55/2, TÍTULO 987...). */
const DOC_RE = /\b(?:nfs?-?e?|nota(?: fiscal)?|doc(?:umento)?|dupl(?:icata)?|tit(?:ulo)?|fatura|fat|boleto|cte?)\b\D{0,6}(\d{2,})/i

const docOf = (history: string) => {
  const m = DOC_RE.exec(history.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  return m ? m[1].replace(/^0+/, '') : ''
}

/**
 * Composição de saldo de uma conta: casa débitos com créditos e devolve o que sobrou em aberto.
 * 1) pelo número do documento no histórico, quando débitos e créditos do documento se anulam;
 * 2) um a um pelo mesmo valor, do mais antigo para o mais novo.
 */
export function composeAccount(account: LedgerAccount): AccountComposition {
  // O saldo anterior entra como um item a mais: uma baixa no período pode quitá-lo.
  const opening: LedgerEntry | null = account.openingBalance
    ? {
        account: account.code,
        date: '',
        history: 'SALDO ANTERIOR',
        debit: Math.max(account.openingBalance, 0),
        credit: Math.max(-account.openingBalance, 0),
      }
    : null
  const open = new Set<LedgerEntry>(opening ? [opening, ...account.entries] : account.entries)
  const signed = (e: LedgerEntry) => e.debit - e.credit

  const byDoc = new Map<string, LedgerEntry[]>()
  for (const e of account.entries) {
    const doc = docOf(e.history)
    if (doc) byDoc.set(doc, [...(byDoc.get(doc) ?? []), e])
  }
  for (const group of byDoc.values()) {
    if (group.length > 1 && group.reduce((s, e) => s + signed(e), 0) === 0) group.forEach((e) => open.delete(e))
  }

  const byDate = (a: LedgerEntry, b: LedgerEntry) => a.date.localeCompare(b.date)
  const credits = new Map<number, LedgerEntry[]>()
  for (const e of [...open].filter((e) => e.credit > 0).sort(byDate))
    credits.set(e.credit, [...(credits.get(e.credit) ?? []), e])
  for (const d of [...open].filter((e) => e.debit > 0).sort(byDate)) {
    const c = credits.get(d.debit)?.shift()
    if (c) (open.delete(d), open.delete(c))
  }

  const items: OpenItem[] = [...open].sort(byDate).map((e) => ({ date: e.date, history: e.history, amount: signed(e) }))
  return {
    account: account.code,
    name: account.name,
    balance: closingBalance(account),
    matched: account.entries.filter((e) => !open.has(e)).length,
    open: items,
  }
}

/** Monta a composição das contas patrimoniais e aponta o que merece atenção. */
export function reconcileAccounts(
  ledger: LedgerAccount[],
  cfg: CompanyConfig,
  today: string,
): { compositions: AccountComposition[]; issues: Issue[] } {
  const prefixes = cfg.reconcilePrefixes ?? ['1', '2']
  const stale = cfg.staleDays ?? 90
  const banks = new Set(cfg.bankAccounts.map((b) => b.ledgerAccount))
  const compositions: AccountComposition[] = []
  const issues: Issue[] = []

  for (const acc of ledger) {
    // Banco é conciliado contra o extrato; contas de resultado não têm saldo a compor.
    if (banks.has(acc.code)) continue
    if (acc.classification && !prefixes.some((p) => acc.classification.startsWith(p))) continue
    const comp = composeAccount(acc)
    compositions.push(comp)

    // Ativo (1) com saldo credor ou passivo (2) com saldo devedor quase sempre é erro de lançamento.
    const inverted =
      (acc.classification.startsWith('1') && comp.balance < 0) || (acc.classification.startsWith('2') && comp.balance > 0)
    // Contas redutoras (depreciação, PDD...) têm saldo invertido por natureza.
    if (inverted && !/\(-\)|deprecia|amortiza|provis|perdas|redutor/i.test(acc.name))
      issues.push({
        kind: 'saldo_invertido',
        account: acc.code,
        amount: comp.balance,
        detail: `${acc.name}: saldo ${comp.balance < 0 ? 'credor' : 'devedor'} de ${brMoney(Math.abs(comp.balance))}, invertido para a natureza da conta`,
      })

    for (const item of comp.open) {
      if (!item.date) continue // saldo anterior: a data de origem está fora do razão exportado
      const age = daysBetween(item.date, today)
      if (age > stale)
        issues.push({
          kind: 'item_antigo',
          account: acc.code,
          date: item.date,
          amount: item.amount,
          detail: `${acc.name}: em aberto há ${age} dias desde ${brDate(item.date)}: ${item.history}`,
        })
    }
  }
  return { compositions, issues }
}
