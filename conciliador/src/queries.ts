import { existsSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { composeAccount } from './accounts.ts'
import { closingBalance, readLedger } from './razao.ts'
import type { Dirs } from './run.ts'
import type { CompanyConfig, LedgerAccount } from './types.ts'
import { onlyDigits } from './util.ts'

/** Consultas somente leitura sobre os relatórios que o Domínio exportou. Nada aqui grava ou move arquivo. */

const isLedgerFile = (f: string) => /\.(xlsx|csv)$/i.test(f) && !f.startsWith('~$')
const reais = (cents: number) => cents / 100

async function listDir(dir: string) {
  return existsSync(dir) ? (await readdir(dir)).sort() : []
}

/** O razão mais recente da empresa: o que está na entrada ou, se já foi conciliado, o último arquivado. */
export async function latestLedgerFile(dirs: Dirs, cnpj: string): Promise<string | null> {
  const id = onlyDigits(cnpj)
  const candidates: string[] = []
  const inbox = path.join(dirs.inbox, id)
  for (const f of await listDir(inbox)) if (isLedgerFile(f)) candidates.push(path.join(inbox, f))
  const done = path.join(dirs.done, id)
  for (const run of await listDir(done))
    for (const f of await listDir(path.join(done, run))) if (isLedgerFile(f)) candidates.push(path.join(done, run, f))
  let best: string | null = null
  let bestTime = -1
  for (const f of candidates) {
    const t = (await stat(f)).mtimeMs
    if (t > bestTime) (best = f), (bestTime = t)
  }
  return best
}

const cache = new Map<string, { mtime: number; ledger: LedgerAccount[] }>()

async function loadLedger(dirs: Dirs, cnpj: string) {
  const file = await latestLedgerFile(dirs, cnpj)
  if (!file)
    throw new Error(
      `Nenhum razão exportado para o CNPJ ${onlyDigits(cnpj)}. A Rotina Automática do Domínio precisa gravar o razão em ${path.join(dirs.inbox, onlyDigits(cnpj))}`,
    )
  const mtime = (await stat(file)).mtimeMs
  const hit = cache.get(file)
  if (hit?.mtime === mtime) return { file, mtime, ledger: hit.ledger }
  const ledger = await readLedger(file)
  if (!ledger.length) throw new Error(`Nenhuma conta reconhecida em ${file}: o arquivo não parece um razão do Domínio`)
  cache.set(file, { mtime, ledger })
  return { file, mtime, ledger }
}

function findAccount(ledger: LedgerAccount[], account: string) {
  const acc = ledger.find((a) => a.code === account.trim() || a.classification === account.trim())
  if (!acc) throw new Error(`Conta ${account} não está no razão exportado (use o código reduzido ou a classificação)`)
  return acc
}

const period = (ledger: LedgerAccount[]) => {
  const dates = ledger.flatMap((a) => a.entries.map((e) => e.date)).sort()
  return { de: dates[0] ?? null, ate: dates[dates.length - 1] ?? null }
}

export async function listCompanies(dirs: Dirs) {
  const names = new Map<string, string>()
  for (const f of await listDir(dirs.companies)) {
    if (!f.endsWith('.json')) continue
    try {
      const cfg = JSON.parse(await readFile(path.join(dirs.companies, f), 'utf8')) as CompanyConfig
      names.set(onlyDigits(cfg.cnpj), cfg.name)
    } catch {
      // configuração inválida não impede de listar as outras
    }
  }
  for (const d of [...(await listDir(dirs.inbox)), ...(await listDir(dirs.done))])
    if (/^\d{11,14}$/.test(d) && !names.has(d)) names.set(d, '')
  const out = []
  for (const [cnpj, nome] of [...names].sort()) {
    const file = await latestLedgerFile(dirs, cnpj)
    out.push({
      cnpj,
      nome,
      razao: file ? path.basename(file) : null,
      exportado_em: file ? (await stat(file)).mtime.toISOString() : null,
    })
  }
  return out
}

export async function trialBalance(dirs: Dirs, cnpj: string) {
  const { file, mtime, ledger } = await loadLedger(dirs, cnpj)
  return {
    fonte: path.basename(file),
    exportado_em: new Date(mtime).toISOString(),
    periodo: period(ledger),
    contas: ledger.map((a) => ({
      conta: a.code,
      classificacao: a.classification,
      nome: a.name,
      saldo_anterior: reais(a.openingBalance),
      debitos: reais(a.entries.reduce((s, e) => s + e.debit, 0)),
      creditos: reais(a.entries.reduce((s, e) => s + e.credit, 0)),
      saldo: reais(closingBalance(a)),
    })),
  }
}

export interface EntryFilter {
  conta?: string
  texto?: string
  valor?: number
  de?: string
  ate?: string
  limite?: number
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export async function findEntries(dirs: Dirs, cnpj: string, f: EntryFilter) {
  const { file, mtime, ledger } = await loadLedger(dirs, cnpj)
  const accounts = f.conta ? [findAccount(ledger, f.conta)] : ledger
  const text = f.texto ? plain(f.texto) : ''
  const cents = f.valor !== undefined ? Math.round(Math.abs(f.valor) * 100) : null
  const limit = Math.min(Math.max(f.limite ?? 200, 1), 1000)
  const found = accounts
    .flatMap((a) => a.entries.map((e) => ({ a, e })))
    .filter(
      ({ e }) =>
        (!f.de || e.date >= f.de) &&
        (!f.ate || e.date <= f.ate) &&
        (!text || plain(e.history).includes(text)) &&
        (cents === null || e.debit === cents || e.credit === cents),
    )
    .sort((x, y) => x.e.date.localeCompare(y.e.date))
  return {
    fonte: path.basename(file),
    exportado_em: new Date(mtime).toISOString(),
    total: found.length,
    // Avisa quando a lista foi cortada, para ninguém somar uma lista incompleta achando que é tudo.
    cortado: found.length > limit,
    total_debitos: reais(found.reduce((s, { e }) => s + e.debit, 0)),
    total_creditos: reais(found.reduce((s, { e }) => s + e.credit, 0)),
    lancamentos: found.slice(0, limit).map(({ a, e }) => ({
      data: e.date,
      conta: a.code,
      nome_conta: a.name,
      historico: e.history,
      debito: reais(e.debit),
      credito: reais(e.credit),
      contrapartida: e.counterpart ?? null,
      lote: e.batch ?? null,
    })),
  }
}

export async function accountComposition(dirs: Dirs, cnpj: string, account: string) {
  const { file, mtime, ledger } = await loadLedger(dirs, cnpj)
  const comp = composeAccount(findAccount(ledger, account))
  return {
    fonte: path.basename(file),
    exportado_em: new Date(mtime).toISOString(),
    conta: comp.account,
    nome: comp.name,
    saldo: reais(comp.balance),
    lancamentos_conciliados: comp.matched,
    em_aberto: comp.open.map((o) => ({ data: o.date || null, historico: o.history, valor: reais(o.amount) })),
  }
}

/** Relatório de pendências da última conciliação (gerado pelo conciliador). */
export async function latestIssues(dirs: Dirs, cnpj: string) {
  const out = path.join(dirs.out, onlyDigits(cnpj))
  const files = (await listDir(out)).filter((f) => /^pendencias_.*\.csv$/.test(f))
  if (!files.length) throw new Error(`Nenhuma conciliação rodou ainda para o CNPJ ${onlyDigits(cnpj)}`)
  const file = files[files.length - 1]
  const lines = (await readFile(path.join(out, file), 'latin1')).split('\r\n').filter(Boolean).slice(1)
  return {
    fonte: file,
    pendencias: lines.map((l) => {
      const [tipo, conta, data, valor, detalhe] = l.slice(1, -1).split('";"').map((c) => c.replace(/""/g, '"'))
      return { tipo, conta: conta || null, data: data || null, valor: valor || null, detalhe }
    }),
  }
}
