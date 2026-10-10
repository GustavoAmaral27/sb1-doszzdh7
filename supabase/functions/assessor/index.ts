// O "assessor": recebe uma mensagem em linguagem natural, registra
// lançamentos e responde perguntas sobre as finanças do usuário.
import { handle, json, requireUser, HttpError, admin } from '../_shared/http.ts'
import { parseMessage } from '../_shared/parser.ts'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const HELP = [
  'Oi! Sou seu assessor financeiro. Você pode me mandar coisas como:',
  '• "gastei 42,90 no ifood"',
  '• "paguei 180 de luz ontem"',
  '• "recebi 5.000 de salário"',
  '• "quanto gastei esse mês?"',
  '• "gastos com mercado na semana"',
  '• "saldo"',
].join('\n')

Deno.serve(handle(async (req) => {
  const user = await requireUser(req)
  const { message } = await req.json().catch(() => ({}))
  if (typeof message !== 'string' || !message.trim() || message.length > 500) {
    throw new HttpError(400, 'Mensagem inválida')
  }

  // Limite simples de uso: 30 mensagens por minuto por usuário.
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await admin.from('assessor_messages').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('role', 'user').gte('created_at', since)
  if ((count ?? 0) >= 30) throw new HttpError(429, 'Muitas mensagens. Aguarde um minuto.')

  await admin.from('assessor_messages').insert({ user_id: user.id, role: 'user', content: message.trim() })

  const intent = parseMessage(message)
  let reply = ''
  let transactionId: string | null = null

  if (intent.type === 'transaction') {
    const { data: cat } = await admin.from('categories').select('id,name')
      .is('user_id', null).eq('name', intent.category).maybeSingle()
    const { data: tx, error } = await admin.from('transactions').insert({
      user_id: user.id,
      description: intent.description,
      amount: intent.amount,
      kind: intent.kind,
      occurred_on: intent.date,
      category_id: cat?.id ?? null,
      source: 'assessor',
    }).select('id').single()
    if (error) throw error
    transactionId = tx.id
    const when = intent.date === new Date().toISOString().slice(0, 10) ? 'hoje' : intent.date.split('-').reverse().join('/')
    reply = intent.kind === 'expense'
      ? `✅ Despesa registrada!\n💸 ${brl(intent.amount)} — ${intent.description}\n🏷️ ${intent.category} · 📅 ${when}`
      : `✅ Receita registrada!\n💰 ${brl(intent.amount)} — ${intent.description}\n🏷️ ${intent.category} · 📅 ${when}`
  } else if (intent.type === 'summary') {
    const now = new Date()
    const start = new Date(now)
    if (intent.period === 'week') start.setDate(now.getDate() - 6)
    else if (intent.period === 'month') start.setDate(1)
    const { data: rows } = await admin.from('transactions')
      .select('amount, kind, categories(name)')
      .eq('user_id', user.id).gte('occurred_on', start.toISOString().slice(0, 10))
    type Row = { amount: number; kind: string; categories: { name: string } | null }
    const list = ((rows ?? []) as unknown as Row[]).filter((r) => !intent.category || r.categories?.name === intent.category)
    const out = list.filter((r) => r.kind === 'expense').reduce((s, r) => s + Number(r.amount), 0)
    const inc = list.filter((r) => r.kind === 'income').reduce((s, r) => s + Number(r.amount), 0)
    const label = { today: 'hoje', week: 'nos últimos 7 dias', month: 'neste mês' }[intent.period]
    if (intent.category) {
      reply = `📊 Gastos com ${intent.category} ${label}: ${brl(out)}`
    } else {
      const byCat = new Map<string, number>()
      for (const r of list) if (r.kind === 'expense') byCat.set(r.categories?.name ?? 'Outros', (byCat.get(r.categories?.name ?? 'Outros') ?? 0) + Number(r.amount))
      const top = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `• ${n}: ${brl(v)}`).join('\n')
      reply = `📊 Resumo ${label}\n💸 Gastos: ${brl(out)}\n💰 Receitas: ${brl(inc)}\n⚖️ Saldo: ${brl(inc - out)}${top ? `\n\nOnde mais gastou:\n${top}` : ''}`
    }
  } else if (intent.type === 'balance') {
    const { data: accs } = await admin.from('accounts').select('name, type, balance').eq('user_id', user.id)
    const bank = (accs ?? []).filter((a) => a.type !== 'credit_card')
    const cards = (accs ?? []).filter((a) => a.type === 'credit_card')
    if (!accs?.length) reply = 'Você ainda não conectou nenhuma conta. Vá em "Contas" e toque em "Conectar banco". 🏦'
    else reply = [
      `🏦 Saldo em contas: ${brl(bank.reduce((s, a) => s + Number(a.balance), 0))}`,
      ...bank.map((a) => `• ${a.name}: ${brl(Number(a.balance))}`),
      cards.length ? `\n💳 Faturas de cartão: ${brl(cards.reduce((s, a) => s + Number(a.balance), 0))}` : '',
    ].filter(Boolean).join('\n')
  } else if (intent.type === 'help') {
    reply = HELP
  } else {
    reply = 'Não entendi 🤔. Tente algo como "gastei 30 no almoço" ou "quanto gastei esse mês?". Digite "ajuda" para ver exemplos.'
  }

  const { data: saved } = await admin.from('assessor_messages')
    .insert({ user_id: user.id, role: 'assistant', content: reply, transaction_id: transactionId })
    .select().single()
  return json(req, { reply: saved, transactionId })
}))
