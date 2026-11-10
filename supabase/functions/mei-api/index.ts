// API do sistema MEI: ações do app (autenticadas), webhook do WhatsApp (Meta), webhook do Asaas e link público da nota.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'
import { responder } from './bot.ts'
import { atualizarNotas, cancelarNota, digitos, emitirNota, Falha, hojeBR } from './notas.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const URL_APP = env('APP_URL') || 'https://gustavoamaral27.github.io/sb1-doszzdh7/mei/'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const rota = url.pathname.split('/').filter(Boolean).pop()
  try {
    if (rota === 'whatsapp') return await whatsapp(req, url)
    if (rota === 'asaas') return await asaasWebhook(req)
    if (rota === 'nota') return await notaPublica(url)
    return await app(req)
  } catch (e: any) {
    if (!(e instanceof Falha)) console.error(e)
    return json({ erro: e instanceof Falha ? e.message : 'Erro interno. Tente de novo.' }, e instanceof Falha ? e.status : 500)
  }
})

// ---------- Ações do app ----------
async function app(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await db.auth.getUser(token)
  if (!auth?.user) throw new Falha('Sessão expirada. Entre de novo.', 401)
  const corpo = await req.json().catch(() => ({}))
  const { data: perfil } = await db.from('mei_perfis').select().eq('user_id', auth.user.id).maybeSingle()
  if (!perfil) throw new Falha('Cadastro não encontrado.', 404)

  switch (corpo.acao) {
    case 'emitir_nota':
      return json({ nota: await emitirNota(db, perfil, { ...corpo.nota, origem: 'app' }) })
    case 'cancelar_nota':
      return json({ nota: await cancelarNota(db, perfil, String(corpo.id), corpo.motivo) })
    case 'atualizar_notas':
      await atualizarNotas(db, perfil)
      return json({ ok: true })
    case 'bot':
      return json({ resposta: await responder(db, perfil, String(corpo.texto ?? '').slice(0, 1000), 'simulador', URL_APP) })
    case 'whatsapp_codigo': {
      const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000)
      await db.from('mei_perfis').update({ whatsapp_codigo: codigo }).eq('user_id', perfil.user_id)
      return json({ codigo })
    }
    case 'whatsapp_desvincular':
      await db.from('mei_perfis').update({ whatsapp: '', whatsapp_codigo: null }).eq('user_id', perfil.user_id)
      return json({ ok: true })
    case 'assinar':
      return json(await assinar(perfil))
    default:
      throw new Falha('Ação desconhecida.')
  }
}

async function notaPublica(url: URL) {
  const t = url.searchParams.get('t') ?? ''
  if (!/^[0-9a-f]{32}$/.test(t)) throw new Falha('Nota não encontrada.', 404)
  const { data: nota } = await db.from('mei_notas').select('user_id,numero,tomador_nome,tomador_documento,descricao,valor,data_emissao,status,ambiente,codigo_verificacao,pdf_url').eq('token', t).maybeSingle()
  if (!nota) throw new Falha('Nota não encontrada.', 404)
  const { data: p } = await db.from('mei_perfis').select('razao_social,cnpj,municipio,uf').eq('user_id', nota.user_id).maybeSingle()
  const { user_id: _, ...publica } = nota
  return json({ nota: publica, prestador: p })
}

// ---------- WhatsApp (Meta Cloud API) ----------
async function enviarWhatsapp(para: string, texto: string) {
  if (!env('WHATSAPP_TOKEN') || !env('WHATSAPP_PHONE_ID')) return console.log('WhatsApp não configurado; resposta:', texto)
  const r = await fetch(`https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } }),
  })
  if (!r.ok) console.error('Falha ao enviar WhatsApp', r.status, await r.text())
}

async function assinaturaValida(req: Request, bruto: string) {
  const segredo = env('WHATSAPP_APP_SECRET')
  if (!segredo) return true
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(bruto)))
  const hex = 'sha256=' + [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === req.headers.get('x-hub-signature-256')
}

async function whatsapp(req: Request, url: URL) {
  if (!env('WHATSAPP_VERIFY_TOKEN')) throw new Falha('WhatsApp não configurado.', 503)
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WHATSAPP_VERIFY_TOKEN')
    return new Response(ok ? url.searchParams.get('hub.challenge') : 'Proibido', { status: ok ? 200 : 403 })
  }
  const bruto = await req.text()
  if (!(await assinaturaValida(req, bruto))) throw new Falha('Assinatura inválida.', 401)
  const evento = JSON.parse(bruto)
  for (const entrada of evento.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      for (const msg of mudanca.value?.messages ?? []) {
        try {
          await receber(digitos(msg.from), msg.type === 'text' ? String(msg.text?.body ?? '') : null)
        } catch (e) {
          console.error('Erro ao tratar mensagem', e)
        }
      }
    }
  }
  return json({ ok: true })
}

async function receber(de: string, texto: string | null) {
  if (!de) return
  if (texto === null) return enviarWhatsapp(de, 'Por enquanto eu só entendo mensagens de texto. Mande "ajuda" para ver os comandos.')
  const vinculo = texto.trim().match(/^vincular\s+(\d{6})$/i)
  if (vinculo) {
    const { data: alvo } = await db.from('mei_perfis').select('user_id,nome').eq('whatsapp_codigo', vinculo[1]).maybeSingle()
    if (!alvo) return enviarWhatsapp(de, 'Código inválido ou vencido. Gere um novo no app, em WhatsApp.')
    await db.from('mei_perfis').update({ whatsapp: '' }).eq('whatsapp', de)
    await db.from('mei_perfis').update({ whatsapp: de, whatsapp_codigo: null }).eq('user_id', alvo.user_id)
    return enviarWhatsapp(de, `✅ WhatsApp conectado${alvo.nome ? ', ' + alvo.nome.split(' ')[0] : ''}! Mande "ajuda" para ver o que posso fazer.`)
  }
  const { data: perfil } = await db.from('mei_perfis').select().eq('whatsapp', de).maybeSingle()
  if (!perfil) return enviarWhatsapp(de, `Ainda não conheço este número. Entre no app (${URL_APP}), abra WhatsApp e envie aqui o código de conexão.`)
  await enviarWhatsapp(de, await responder(db, perfil, texto.slice(0, 1000), 'whatsapp', URL_APP))
}

// ---------- Assinatura (Asaas) ----------
async function asaas(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch((env('ASAAS_URL') || 'https://api.asaas.com/v3') + caminho, {
    method: metodo,
    headers: { access_token: env('ASAAS_API_KEY'), 'Content-Type': 'application/json', 'User-Agent': 'mei-api' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) throw new Falha(dados.errors?.[0]?.description ?? 'Não foi possível falar com o sistema de pagamento.', 502)
  return dados
}

async function assinar(perfil: any) {
  if (!env('ASAAS_API_KEY')) return { configurado: false }
  let cliente = perfil.asaas_customer
  if (!cliente) {
    cliente = (await asaas('POST', '/customers', { name: perfil.razao_social || perfil.nome, cpfCnpj: digitos(perfil.cnpj), email: perfil.email, mobilePhone: perfil.whatsapp.replace(/^55/, '') || undefined, externalReference: perfil.user_id })).id
    await db.from('mei_perfis').update({ asaas_customer: cliente }).eq('user_id', perfil.user_id)
  }
  let assinatura = perfil.asaas_subscription
  if (!assinatura) {
    const { data: cfg } = await db.from('mei_config').select('valor').eq('chave', 'preco_mensal').maybeSingle()
    assinatura = (await asaas('POST', '/subscriptions', { customer: cliente, billingType: 'UNDEFINED', value: Number(cfg?.valor ?? 49.9), nextDueDate: hojeBR(), cycle: 'MONTHLY', description: 'Assinatura mensal', externalReference: perfil.user_id })).id
    await db.from('mei_perfis').update({ asaas_subscription: assinatura }).eq('user_id', perfil.user_id)
  }
  const cobrancas = await asaas('GET', `/subscriptions/${assinatura}/payments?status=PENDING`)
  const aberta = cobrancas.data?.[0] ?? (await asaas('GET', `/subscriptions/${assinatura}/payments?status=OVERDUE`)).data?.[0]
  return { configurado: true, url: aberta?.invoiceUrl ?? null }
}

async function asaasWebhook(req: Request) {
  if (!env('ASAAS_WEBHOOK_TOKEN') || req.headers.get('asaas-access-token') !== env('ASAAS_WEBHOOK_TOKEN')) throw new Falha('Não autorizado.', 401)
  const ev = await req.json()
  const assinatura = ev.payment?.subscription ?? ev.subscription?.id
  if (!assinatura) return json({ ok: true })
  let mudanca: Record<string, unknown> | null = null
  if (ev.event === 'PAYMENT_CONFIRMED' || ev.event === 'PAYMENT_RECEIVED') {
    const ate = new Date(ev.payment.dueDate + 'T12:00:00Z')
    ate.setUTCMonth(ate.getUTCMonth() + 1)
    mudanca = { plano: 'ativo', pago_ate: ate.toISOString().slice(0, 10) }
  } else if (ev.event === 'PAYMENT_OVERDUE') mudanca = { plano: 'atrasado' }
  else if (ev.event === 'SUBSCRIPTION_DELETED' || ev.event === 'SUBSCRIPTION_INACTIVATED') mudanca = { plano: 'cancelado', asaas_subscription: null }
  if (mudanca) await db.from('mei_perfis').update(mudanca).eq('asaas_subscription', assinatura)
  return json({ ok: true })
}
