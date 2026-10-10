// Cliente mínimo da API Pluggy (Open Finance Brasil). As chaves ficam apenas
// nos segredos das Edge Functions — nunca no navegador.
import { admin, audit } from './http.ts'

const BASE = 'https://api.pluggy.ai'
let cached: { key: string; exp: number } | null = null

async function apiKey(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.key
  const res = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: Deno.env.get('PLUGGY_CLIENT_ID'),
      clientSecret: Deno.env.get('PLUGGY_CLIENT_SECRET'),
    }),
  })
  if (!res.ok) throw new Error(`Pluggy auth falhou: ${res.status}`)
  const { apiKey } = await res.json()
  cached = { key: apiKey, exp: Date.now() + 90 * 60 * 1000 } // a chave vale 2h
  return apiKey
}

export async function pluggy<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': await apiKey(), ...init.headers },
  })
  if (!res.ok) throw new Error(`Pluggy ${path} falhou: ${res.status}`)
  return res.status === 204 ? (undefined as T) : res.json()
}

interface PluggyItem {
  id: string
  status: string
  clientUserId: string | null
  connector: { name: string; imageUrl: string }
}

interface PluggyAccount {
  id: string
  type: 'BANK' | 'CREDIT'
  subtype: 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'CREDIT_CARD'
  name: string
  marketingName?: string | null
  number: string
  balance: number
  currencyCode: string
  creditData?: { creditLimit?: number; availableCreditLimit?: number; balanceDueDate?: string } | null
}

interface PluggyTransaction {
  id: string
  description: string
  amount: number
  date: string
  type: 'DEBIT' | 'CREDIT'
  category?: string | null
}

export function getItem(itemId: string) {
  return pluggy<PluggyItem>(`/items/${encodeURIComponent(itemId)}`)
}

const mask = (n: string) => (n ? `•••• ${n.replace(/\D/g, '').slice(-4)}` : null)

// Mapeia categorias da Pluggy para as categorias padrão do app.
const categoryMap: [RegExp, string][] = [
  [/groceries|supermarket/i, 'Mercado'],
  [/food|restaurant|eating/i, 'Alimentação'],
  [/transport|taxi|ride|gas station|fuel|parking/i, 'Transporte'],
  [/housing|rent|utilities|electricity|water/i, 'Moradia'],
  [/health|pharmacy|hospital/i, 'Saúde'],
  [/education/i, 'Educação'],
  [/leisure|entertainment|travel/i, 'Lazer'],
  [/subscription|streaming|digital services/i, 'Assinaturas'],
  [/shopping/i, 'Compras'],
  [/salary|wage/i, 'Salário'],
  [/investment/i, 'Investimentos'],
]

/** Baixa contas e transações de um item e grava tudo com service_role. */
export async function syncItem(userId: string, itemId: string) {
  const item = await getItem(itemId)
  // Defesa contra sequestro de conexão: o item tem de pertencer a este usuário.
  if (item.clientUserId !== userId) throw new Error('Item não pertence ao usuário')

  const { data: conn, error } = await admin
    .from('bank_connections')
    .upsert(
      {
        user_id: userId,
        item_id: item.id,
        institution_name: item.connector.name,
        institution_logo: item.connector.imageUrl,
        status: item.status,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'item_id' },
    )
    .select()
    .single()
  if (error) throw error

  const { data: cats } = await admin.from('categories').select('id,name').is('user_id', null)
  const catId = (name: string) => cats?.find((c) => c.name === name)?.id ?? null

  const { results: accounts } = await pluggy<{ results: PluggyAccount[] }>(`/accounts?itemId=${item.id}`)
  const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)

  for (const a of accounts) {
    const isCard = a.subtype === 'CREDIT_CARD'
    const { data: acc, error: accErr } = await admin
      .from('accounts')
      .upsert(
        {
          user_id: userId,
          connection_id: conn.id,
          external_id: a.id,
          type: isCard ? 'credit_card' : a.subtype === 'SAVINGS_ACCOUNT' ? 'savings' : 'checking',
          name: a.marketingName || a.name,
          institution_name: item.connector.name,
          number_masked: mask(a.number),
          balance: a.balance,
          credit_limit: a.creditData?.creditLimit ?? null,
          available_credit: a.creditData?.availableCreditLimit ?? null,
          bill_due_day: a.creditData?.balanceDueDate ? new Date(a.creditData.balanceDueDate).getUTCDate() : null,
          currency: a.currencyCode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'external_id' },
      )
      .select()
      .single()
    if (accErr) throw accErr

    for (let page = 1, total = 1; page <= total && page <= 20; page++) {
      const res = await pluggy<{ results: PluggyTransaction[]; totalPages: number }>(
        `/transactions?accountId=${a.id}&from=${from}&pageSize=500&page=${page}`,
      )
      total = res.totalPages
      const rows = res.results.map((t) => {
        // Em cartão, compras vêm positivas; em conta, débitos vêm negativos.
        const expense = isCard ? t.amount > 0 : t.type === 'DEBIT'
        const mapped = categoryMap.find(([re]) => re.test(t.category ?? ''))?.[1]
        return {
          user_id: userId,
          account_id: acc.id,
          external_id: t.id,
          description: (t.description || 'Transação').slice(0, 200),
          amount: Math.abs(t.amount),
          kind: expense ? 'expense' : 'income',
          occurred_on: t.date.slice(0, 10),
          source: 'open_finance',
          category_id: catId(mapped ?? (expense ? 'Outros' : 'Outras receitas')),
        }
      }).filter((r) => r.amount > 0)
      if (rows.length) {
        // ignoreDuplicates preserva a categoria que o usuário já ajustou.
        const { error: txErr } = await admin.from('transactions').upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
        if (txErr) throw txErr
      }
    }
  }

  await audit(userId, 'bank.sync', { institution: item.connector.name, accounts: accounts.length })
  return { institution: item.connector.name, accounts: accounts.length }
}
