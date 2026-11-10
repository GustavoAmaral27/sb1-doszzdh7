import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { reconcileAccounts } from './accounts.ts'
import { ledgerAccountFor, reconcileBank } from './bank.ts'
import { buildDominioTxt } from './dominio.ts'
import { parseOfx } from './ofx.ts'
import { readLedger } from './razao.ts'
import type { AccountComposition, CompanyConfig, Issue, NewEntry } from './types.ts'
import { brDate, brMoney, onlyDigits } from './util.ts'

export interface Dirs {
  /** entrada/<CNPJ>/ : onde chegam o razão (xlsx/csv) e os extratos (ofx) */
  inbox: string
  /** saida/<CNPJ>/ : TXT de importação e relatórios */
  out: string
  /** processados/<CNPJ>/<data-hora>/ : arquivos de entrada já usados */
  done: string
  /** empresas/<CNPJ>.json : configuração de cada empresa */
  companies: string
  /** estado/<CNPJ>.json : o que já foi gerado, para nunca gerar em dobro */
  state: string
}

export const dirsFrom = (base: string): Dirs => ({
  inbox: path.join(base, 'entrada'),
  out: path.join(base, 'saida'),
  done: path.join(base, 'processados'),
  companies: path.join(base, 'empresas'),
  state: path.join(base, 'estado'),
})

export interface CompanyRun {
  cnpj: string
  name: string
  status: 'ok' | 'aguardando_razao' | 'erro'
  matched: number
  entries: number
  unclassified: number
  issues: number
  txt?: string
  error?: string
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)

async function readJson<T>(file: string, fallback: T): Promise<T> {
  return existsSync(file) ? (JSON.parse(await readFile(file, 'utf8')) as T) : fallback
}

/** Processa uma empresa: concilia tudo que está na pasta de entrada dela. */
export async function runCompany(cfg: CompanyConfig, dirs: Dirs, now = new Date()): Promise<CompanyRun> {
  const cnpj = onlyDigits(cfg.cnpj)
  const base: CompanyRun = { cnpj, name: cfg.name, status: 'ok', matched: 0, entries: 0, unclassified: 0, issues: 0 }
  const inbox = path.join(dirs.inbox, cnpj)
  const files = existsSync(inbox) ? (await readdir(inbox)).sort() : []
  const ledgerFiles = files.filter((f) => /\.(xlsx|csv)$/i.test(f) && !f.startsWith('~$'))
  const ofxFiles = files.filter((f) => /\.ofx$/i.test(f))
  // Sem razão não há com o que conciliar: os extratos ficam esperando a próxima exportação.
  if (!ledgerFiles.length) return { ...base, status: 'aguardando_razao' }

  // Se houver mais de um razão, vale o mais recente (a rotina do Domínio sobrescreve ou acumula).
  const ledgerFile = ledgerFiles[ledgerFiles.length - 1]
  const ledger = await readLedger(path.join(inbox, ledgerFile))
  if (!ledger.length) throw new Error(`Nenhuma conta reconhecida em ${ledgerFile}: o arquivo não parece um razão do Domínio`)

  const stateFile = path.join(dirs.state, `${cnpj}.json`)
  const state = await readJson<{ sent: string[] }>(stateFile, { sent: [] })
  const sent = new Set(state.sent)
  const entries: NewEntry[] = []
  const issues: Issue[] = []
  let matched = 0

  for (const f of ofxFiles) {
    for (const stmt of parseOfx(await readFile(path.join(inbox, f)))) {
      const code = ledgerAccountFor(stmt, cfg)
      if (!code) {
        issues.push({ kind: 'extrato_sem_conta', detail: `${f}: conta ${stmt.acctId} (banco ${stmt.bankId}) não está em bankAccounts da empresa` })
        continue
      }
      // Conta de banco sem movimento no período não aparece no razão: trata como conta zerada.
      const account = ledger.find((a) => a.code === code) ?? { code, classification: '', name: '', openingBalance: 0, entries: [] }
      const r = reconcileBank(stmt, account, cfg, sent)
      matched += r.matched
      issues.push(...r.issues)
      // O mesmo movimento pode vir em dois arquivos de extrato com períodos sobrepostos.
      for (const e of r.entries) if (!sent.has(e.key)) (sent.add(e.key), entries.push(e))
    }
  }

  const today = now.toISOString().slice(0, 10)
  const { compositions, issues: accountIssues } = reconcileAccounts(ledger, cfg, today)
  issues.push(...accountIssues)

  const tag = stamp(now)
  const out = path.join(dirs.out, cnpj)
  await mkdir(out, { recursive: true })
  let txt: string | undefined
  if (entries.length) {
    txt = path.join(out, `lancamentos_${tag}.txt`)
    await writeFile(txt, buildDominioTxt(cnpj, entries))
  }
  await writeFile(path.join(out, `pendencias_${tag}.csv`), issuesCsv(issues), 'latin1')
  await writeFile(path.join(out, `composicao_${tag}.csv`), compositionCsv(compositions), 'latin1')

  // Só depois de gravar a saída é que o estado e a pasta de entrada mudam:
  // se algo falhar antes, a próxima execução refaz tudo do zero.
  await mkdir(dirs.state, { recursive: true })
  await writeFile(stateFile, JSON.stringify({ sent: [...sent] }))
  const done = path.join(dirs.done, cnpj, tag)
  await mkdir(done, { recursive: true })
  for (const f of [...ledgerFiles, ...ofxFiles]) await rename(path.join(inbox, f), path.join(done, f))

  return {
    ...base,
    matched,
    entries: entries.length,
    unclassified: entries.filter((e) => !e.classified).length,
    issues: issues.length,
    txt,
  }
}

/** Processa todas as empresas configuradas. O erro de uma não impede as outras. */
export async function runAll(dirs: Dirs, now = new Date()): Promise<CompanyRun[]> {
  const results: CompanyRun[] = []
  const configs = existsSync(dirs.companies) ? (await readdir(dirs.companies)).filter((f) => f.endsWith('.json')).sort() : []
  for (const f of configs) {
    let cfg: CompanyConfig | undefined
    try {
      cfg = JSON.parse(await readFile(path.join(dirs.companies, f), 'utf8')) as CompanyConfig
      if (!cfg.cnpj || !cfg.transitAccount || !Array.isArray(cfg.bankAccounts))
        throw new Error('configuração precisa de cnpj, transitAccount e bankAccounts')
      results.push(await runCompany(cfg, dirs, now))
    } catch (err) {
      results.push({
        cnpj: cfg?.cnpj ?? f,
        name: cfg?.name ?? f,
        status: 'erro',
        matched: 0,
        entries: 0,
        unclassified: 0,
        issues: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  await mkdir(dirs.out, { recursive: true })
  await writeFile(path.join(dirs.out, `resumo_${stamp(now)}.json`), JSON.stringify(results, null, 2))
  return results
}

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n') + '\r\n'

const issuesCsv = (issues: Issue[]) =>
  csv([
    ['Tipo', 'Conta', 'Data', 'Valor', 'Detalhe'],
    ...issues.map((i) => [i.kind, i.account ?? '', i.date ? brDate(i.date) : '', i.amount !== undefined ? brMoney(i.amount) : '', i.detail]),
  ])

const compositionCsv = (comps: AccountComposition[]) =>
  csv([
    ['Conta', 'Nome', 'Saldo', 'Data', 'Valor em aberto', 'Histórico'],
    ...comps.flatMap((c) =>
      c.open.length
        ? c.open.map((o) => [c.account, c.name, brMoney(c.balance), o.date && brDate(o.date), brMoney(o.amount), o.history])
        : [[c.account, c.name, brMoney(c.balance), '', '', 'Conta zerada e conciliada']],
    ),
  ])
