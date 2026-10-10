// Gera um token de conexão de curta duração para o widget Pluggy Connect.
// O token fica amarrado ao id do usuário (clientUserId) para que, depois,
// possamos provar que o item conectado pertence a ele.
import { handle, json, requireUser, audit, HttpError, admin } from '../_shared/http.ts'
import { pluggy } from '../_shared/pluggy.ts'

Deno.serve(handle(async (req) => {
  const user = await requireUser(req)
  const { itemId } = await req.json().catch(() => ({}))

  if (itemId !== undefined) {
    // Reconexão: só é permitida para itens do próprio usuário.
    const { data } = await admin.from('bank_connections').select('id').eq('item_id', itemId).eq('user_id', user.id).maybeSingle()
    if (!data) throw new HttpError(404, 'Conexão não encontrada')
  }

  const { accessToken } = await pluggy<{ accessToken: string }>('/connect_token', {
    method: 'POST',
    body: JSON.stringify({ itemId, options: { clientUserId: user.id } }),
  })

  await audit(user.id, 'bank.connect_token', { reconnect: Boolean(itemId) })
  return json(req, { accessToken })
}))
