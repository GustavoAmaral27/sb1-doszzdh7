import type { Cents } from './types.ts'

/** "1.234,56", "1234.56", "-10,00", "(10,00)", "10,00D", "10,00C" ou número → centavos. null se não for valor. */
export function parseMoney(v: unknown): Cents | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null
  if (typeof v !== 'string') return null
  let s = v.trim().replace(/^R\$\s*/i, '')
  if (!s) return null
  let sign = 1
  const suffix = /\s*([DC])$/i.exec(s)
  if (suffix) {
    if (suffix[1].toUpperCase() === 'C') sign = -1
    s = s.slice(0, suffix.index)
  }
  if (/^\(.*\)$/.test(s)) {
    sign = -sign
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    sign = -sign
    s = s.slice(1)
  } else if (s.endsWith('-')) {
    sign = -sign
    s = s.slice(0, -1)
  }
  if (!/^\d[\d.,]*$/.test(s)) return null
  // O último separador seguido de 1 ou 2 dígitos é o decimal; o resto é milhar.
  const m = /^(.*?)[.,](\d{1,2})$/.exec(s)
  const int = (m ? m[1] : s).replace(/[.,]/g, '')
  const dec = m ? m[2].padEnd(2, '0') : '00'
  if (!/^\d*$/.test(int)) return null
  return sign * (Number(int || '0') * 100 + Number(dec))
}

/** dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd ou Date → AAAA-MM-DD. null se não for data. */
export function parseDate(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)
  if (typeof v !== 'string') return null
  const s = v.trim()
  let m = /^(\d{2})\/(\d{2})\/(\d{4}|\d{2})$/.exec(s)
  if (m) return check(m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1])
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? check(m[1], m[2], m[3]) : null
}

function check(y: string, mo: string, d: string): string | null {
  const iso = `${y}-${mo}-${d}`
  const t = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : null
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

export const brMoney = (c: Cents) => {
  const abs = Math.abs(c)
  return `${c < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export const onlyDigits = (s: string) => s.replace(/\D/g, '')
