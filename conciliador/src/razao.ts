import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import type { LedgerAccount } from './types.ts'
import { parseDate, parseMoney } from './util.ts'

type Row = unknown[]

const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/** Lê o razão exportado pelo Domínio (xlsx ou csv) e devolve as contas com seus lançamentos. */
export async function readLedger(file: string): Promise<LedgerAccount[]> {
  const rows = /\.xlsx$/i.test(file) ? await xlsxRows(file) : csvRows(await readFile(file))
  return parseLedgerRows(rows)
}

async function xlsxRows(file: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const rows: Row[] = []
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: Row = []
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value as unknown
        cells[col - 1] =
          v && typeof v === 'object' && !(v instanceof Date)
            ? 'result' in v
              ? (v as { result: unknown }).result
              : cell.text
            : v
      })
      rows.push(Array.from(cells, (c) => c ?? ''))
    })
  }
  return rows
}

export function csvRows(buf: Buffer): Row[] {
  // O Domínio grava em ANSI (Windows-1252); se o arquivo não for UTF-8 válido, lê como latin1.
  let text = buf.toString('utf8')
  if (text.includes('�')) text = buf.toString('latin1')
  text = text.replace(/^﻿/, '')
  const sep = (text.split('\n', 1)[0].match(/;/g)?.length ?? 0) > 0 || !text.includes(',') ? ';' : ','
  const rows: Row[] = []
  let row: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cur += '"'), i++
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) (row.push(cur), (cur = ''))
    else if (ch === '\n') (row.push(cur.replace(/\r$/, '')), rows.push(row), (row = []), (cur = ''))
    else cur += ch
  }
  if (cur || row.length) (row.push(cur), rows.push(row))
  return rows
}

interface Columns {
  date: number
  history: number
  debit: number
  credit: number
  counterpart: number
  batch: number
}

function findColumns(row: Row): Columns | null {
  const idx = (re: RegExp) => row.findIndex((c) => re.test(norm(c)))
  const cols = {
    date: idx(/^data$/),
    history: idx(/^historico/),
    debit: idx(/^debito/),
    credit: idx(/^credito/),
    counterpart: idx(/c\.?\s*part|contrapartida/),
    batch: idx(/^lote|^lancamento|^lcto/),
  }
  return cols.date >= 0 && cols.debit >= 0 && cols.credit >= 0 ? cols : null
}

/** "Conta: 8 - 1.1.1.02.001 BANCO ITAU" (as partes podem vir em células separadas). */
const ACCOUNT_RE = /^conta:?\s*(\d+)\s*-?\s*((?:\d+\.)+\d+)?\s*-?\s*(.*)$/i

export function parseLedgerRows(rows: Row[]): LedgerAccount[] {
  const accounts: LedgerAccount[] = []
  let cols: Columns | null = null
  let acc: LedgerAccount | null = null

  for (const row of rows) {
    const joined = row.map((c) => String(c ?? '').trim()).filter(Boolean).join(' ')
    if (!joined) continue

    const header = findColumns(row)
    if (header) {
      cols = header
      continue
    }

    const m = ACCOUNT_RE.exec(joined)
    if (m) {
      acc = { code: m[1], classification: m[2] ?? '', name: m[3].trim(), openingBalance: 0, entries: [] }
      accounts.push(acc)
      continue
    }
    if (!acc) continue

    if (/saldo anterior/i.test(norm(joined))) {
      const values = row.map(parseMoney).filter((v): v is number => v !== null)
      if (values.length) acc.openingBalance = values[values.length - 1]
      continue
    }
    if (!cols) continue

    const date = parseDate(row[cols.date])
    const text = (i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '')
    if (!date) {
      // Linha sem data logo após um lançamento: continuação do histórico.
      const last = acc.entries[acc.entries.length - 1]
      const extra = text(cols.history)
      if (last && extra && !/^total|^saldo/i.test(norm(joined))) last.history += ` ${extra}`
      continue
    }
    const debit = parseMoney(row[cols.debit]) ?? 0
    const credit = parseMoney(row[cols.credit]) ?? 0
    if (!debit && !credit) continue
    acc.entries.push({
      account: acc.code,
      date,
      history: text(cols.history),
      debit,
      credit,
      counterpart: text(cols.counterpart) || undefined,
      batch: text(cols.batch) || undefined,
    })
  }
  return accounts
}

export const closingBalance = (a: LedgerAccount) =>
  a.entries.reduce((s, e) => s + e.debit - e.credit, a.openingBalance)
