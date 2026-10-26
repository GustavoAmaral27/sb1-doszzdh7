import { supabase } from './supabase'
import type { Settings, Transaction } from '../types'

/** Linha da tabela fin_lancamentos. */
interface Row {
  id: string
  user_id: string
  company: Transaction['company']
  type: Transaction['type']
  description: string
  category: string
  party: string
  amount: number | string
  due_date: string
  paid: boolean
  paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted: boolean
}

const EPOCH = '1970-01-01T00:00:00.000Z'
const stamp = (t: { updatedAt?: string }) => t.updatedAt ?? EPOCH
const newer = (a?: string, b?: string) => new Date(a ?? EPOCH).getTime() > new Date(b ?? EPOCH).getTime()

const fromRow = (r: Row): Transaction => ({
  id: r.id,
  company: r.company,
  type: r.type,
  description: r.description,
  category: r.category,
  party: r.party,
  amount: Number(r.amount),
  dueDate: r.due_date,
  paid: r.paid,
  paidDate: r.paid_date ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deleted: r.deleted,
})

const toRow = (t: Transaction, userId: string): Row => ({
  id: t.id,
  user_id: userId,
  company: t.company,
  type: t.type,
  description: t.description,
  category: t.category,
  party: t.party,
  amount: t.amount,
  due_date: t.dueDate,
  paid: t.paid,
  paid_date: t.paid ? t.paidDate ?? t.dueDate : null,
  notes: t.notes ?? null,
  created_at: t.createdAt || new Date().toISOString(),
  updated_at: stamp(t),
  deleted: !!t.deleted,
})

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('fin_lancamentos').select('*').range(from, from + 999)
    if (error) throw error
    rows.push(...(data as Row[]))
    if (!data || data.length < 1000) return rows
  }
}

/**
 * Junta o que está no celular com o que está na nuvem: para cada lançamento vale a
 * versão alterada por último. Envia para a nuvem o que só o celular tem de mais novo
 * e devolve a lista final para gravar no celular.
 */
export async function syncAll(local: Transaction[], settings: Settings, userId: string) {
  const remote = await fetchAll()
  const byId = new Map(local.map((t) => [t.id, t]))
  const remoteIds = new Set<string>()
  for (const r of remote) {
    remoteIds.add(r.id)
    const l = byId.get(r.id)
    if (!l || !newer(stamp(l), r.updated_at)) byId.set(r.id, fromRow(r))
  }
  const remoteStamp = new Map(remote.map((r) => [r.id, r.updated_at]))
  const toPush = local.filter((t) => !remoteIds.has(t.id) || newer(stamp(t), remoteStamp.get(t.id)))
  for (let i = 0; i < toPush.length; i += 500) {
    const { error } = await supabase
      .from('fin_lancamentos')
      .upsert(toPush.slice(i, i + 500).map((t) => toRow(t, userId)), { onConflict: 'user_id,id' })
    if (error) throw error
  }

  const { data: cfg, error: cfgErr } = await supabase.from('fin_config').select('*').maybeSingle()
  if (cfgErr) throw cfgErr
  let mergedSettings = settings
  if (cfg && !newer(settings.updatedAt, cfg.updated_at)) {
    mergedSettings = { initialBalance: { ztec: 0, amaral: 0, ...cfg.initial_balance }, updatedAt: cfg.updated_at }
  } else if (!cfg || newer(settings.updatedAt, cfg.updated_at)) {
    const { error } = await supabase.from('fin_config').upsert({
      user_id: userId,
      initial_balance: settings.initialBalance,
      updated_at: settings.updatedAt ?? new Date().toISOString(),
    })
    if (error) throw error
  }

  return { transactions: [...byId.values()], settings: mergedSettings }
}
