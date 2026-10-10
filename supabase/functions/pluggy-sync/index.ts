// Sincroniza (ou remove) uma conexão bancária do usuário autenticado.
import { handle, json, requireUser, audit, HttpError, admin } from '../_shared/http.ts'
import { pluggy, syncItem } from '../_shared/pluggy.ts'

Deno.serve(handle(async (req) => {
  const user = await requireUser(req)
  const body = await req.json().catch(() => ({}))
  const itemId = typeof body.itemId === 'string' && /^[0-9a-f-]{36}$/i.test(body.itemId) ? body.itemId : null
  if (!itemId) throw new HttpError(400, 'itemId inválido')

  if (body.action === 'delete') {
    const { data } = await admin.from('bank_connections').select('id').eq('item_id', itemId).eq('user_id', user.id).maybeSingle()
    if (!data) throw new HttpError(404, 'Conexão não encontrada')
    // Revoga o consentimento no agregador e apaga contas/transações em cascata.
    await pluggy(`/items/${itemId}`, { method: 'DELETE' }).catch((e) => console.error(e))
    await admin.from('bank_connections').delete().eq('id', data.id)
    await audit(user.id, 'bank.disconnect', { itemId })
    return json(req, { ok: true })
  }

  try {
    return json(req, await syncItem(user.id, itemId))
  } catch (e) {
    if (e instanceof Error && e.message === 'Item não pertence ao usuário') {
      await audit(user.id, 'security.item_ownership_violation', { itemId })
      throw new HttpError(403, 'Conexão não autorizada')
    }
    throw e
  }
}))
