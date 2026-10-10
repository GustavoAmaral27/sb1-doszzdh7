// Recebe avisos da Pluggy quando um item termina de atualizar.
// Segurança: exige um segredo compartilhado e NÃO confia no corpo — o item
// é buscado de novo na API e o dono é conferido pelo clientUserId.
import { admin, audit } from '../_shared/http.ts'
import { syncItem } from '../_shared/pluggy.ts'

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PLUGGY_WEBHOOK_SECRET') ?? ''
  const given = req.headers.get('x-webhook-secret') ?? ''
  if (req.method !== 'POST' || !secret || !safeEqual(given, secret)) {
    return new Response('forbidden', { status: 403 })
  }

  const { event, itemId } = await req.json().catch(() => ({}))
  if (typeof itemId !== 'string') return new Response('ok')

  const { data: conn } = await admin.from('bank_connections').select('user_id').eq('item_id', itemId).maybeSingle()
  if (!conn) return new Response('ok')

  if (event === 'item/deleted') {
    await admin.from('bank_connections').delete().eq('item_id', itemId)
    await audit(conn.user_id, 'bank.deleted_by_provider', { itemId })
  } else if (event === 'item/updated' || event === 'item/created') {
    await syncItem(conn.user_id, itemId).catch((e) => console.error(e))
  } else if (event === 'item/error' || event === 'item/login_succeeded' || event === 'item/waiting_user_input') {
    await admin.from('bank_connections').update({ status: event.split('/')[1].toUpperCase() }).eq('item_id', itemId)
  }
  return new Response('ok')
})
