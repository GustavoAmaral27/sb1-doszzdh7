// Emissão e cancelamento de NFS-e. Sem FOCUS_NFE_TOKEN as notas saem em modo simulação (sem valor fiscal).
// deno-lint-ignore-file no-explicit-any
export const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
export const brl = (v: number) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const digitos = (s: string) => (s || '').replace(/\D/g, '')

export class Falha extends Error {
  status: number
  constructor(msg: string, status = 400) {
    super(msg)
    this.status = status
  }
}

export function liberado(p: any) {
  return p.plano === 'ativo' || (p.plano === 'trial' && p.trial_ate >= hojeBR())
}

const env = (k: string) => (globalThis as any).Deno?.env.get(k) as string | undefined

// Rascunho da integração com a Focus NFe (NFS-e Nacional). Validar em homologação antes de usar.
async function focus(metodo: string, caminho: string, corpo?: unknown) {
  const base = env('FOCUS_NFE_AMBIENTE') === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br'
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { Authorization: 'Basic ' + btoa(env('FOCUS_NFE_TOKEN') + ':'), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  return { ok: r.ok, dados: await r.json().catch(() => ({})) }
}

function resultadoFocus(d: any) {
  if (d.status === 'autorizado') return { status: 'emitida', codigo_verificacao: d.codigo_verificacao ?? '', pdf_url: d.url_danfse ?? d.url ?? '', erro: '' }
  if (d.status === 'processando_autorizacao') return { status: 'processando' }
  return { status: 'erro', erro: d.mensagem ?? d.erros?.map((e: any) => e.mensagem).join('; ') ?? 'Nota rejeitada pelo provedor' }
}

export async function emitirNota(db: any, perfil: any, e: { tomador_nome?: string; tomador_documento?: string; tomador_email?: string; descricao?: string; valor?: number; origem?: string }) {
  if (!liberado(perfil)) throw new Falha('Sua assinatura não está ativa. Regularize em Conta > Assinatura para emitir notas.', 402)
  if (!perfil.onboarded || digitos(perfil.cnpj).length !== 14) throw new Falha('Complete o cadastro da empresa (CNPJ) antes de emitir notas.')
  const valor = Math.round(Number(e.valor) * 100) / 100
  const descricao = (e.descricao || perfil.descricao_servico || '').trim()
  if (!(valor > 0)) throw new Falha('Informe o valor da nota.')
  if (!descricao) throw new Falha('Informe a descrição do serviço.')
  const doc = digitos(e.tomador_documento || '')
  if (doc && doc.length !== 11 && doc.length !== 14) throw new Falha('CPF ou CNPJ do cliente inválido.')
  const producao = !!env('FOCUS_NFE_TOKEN')

  let nota: any = null
  for (let tentativa = 0; tentativa < 4 && !nota; tentativa++) {
    const { data: ult } = await db.from('mei_notas').select('numero').eq('user_id', perfil.user_id).order('numero', { ascending: false }).limit(1)
    const { data, error } = await db
      .from('mei_notas')
      .insert({
        user_id: perfil.user_id,
        numero: (ult?.[0]?.numero ?? 0) + 1,
        tomador_nome: (e.tomador_nome || '').trim() || 'Consumidor não identificado',
        tomador_documento: doc,
        tomador_email: (e.tomador_email || '').trim(),
        descricao,
        valor,
        data_emissao: hojeBR(),
        status: 'processando',
        ambiente: producao ? 'producao' : 'simulacao',
        origem: e.origem || 'app',
      })
      .select()
      .single()
    if (data) nota = data
    else if (error?.code !== '23505') throw new Falha(error?.message ?? 'Erro ao gravar a nota', 500)
  }
  if (!nota) throw new Falha('Não foi possível numerar a nota. Tente de novo.', 500)

  let res: any
  if (producao) {
    const r = await focus('POST', `/v2/nfsen?ref=${nota.id}`, {
      data_emissao: new Date().toISOString(),
      data_competencia: nota.data_emissao,
      codigo_municipio_emissora: perfil.codigo_municipio,
      cnpj_prestador: digitos(perfil.cnpj),
      codigo_opcao_simples_nacional: 2, // MEI
      regime_especial_tributacao: 0,
      ...(doc.length === 11 ? { cpf_tomador: doc } : doc.length === 14 ? { cnpj_tomador: doc } : {}),
      razao_social_tomador: nota.tomador_nome,
      email_tomador: nota.tomador_email || undefined,
      codigo_municipio_prestacao: perfil.codigo_municipio,
      codigo_tributacao_nacional_iss: perfil.codigo_servico,
      descricao_servico: descricao,
      valor_servico: valor,
      tributacao_iss: 1,
      tipo_retencao_iss: 1,
    })
    res = r.ok ? { status: 'processando', provedor_ref: nota.id } : resultadoFocus(r.dados)
  } else {
    res = { status: 'emitida', codigo_verificacao: crypto.randomUUID().replace(/-/g, '').slice(0, 9).toUpperCase() }
  }
  return await gravar(db, perfil, nota, res)
}

async function gravar(db: any, perfil: any, nota: any, res: any) {
  const { data } = await db.from('mei_notas').update(res).eq('id', nota.id).select().single()
  if (data?.status === 'emitida' && nota.status !== 'emitida') {
    await db.from('mei_lancamentos').insert({
      user_id: perfil.user_id,
      tipo: 'receita',
      natureza: 'servico',
      categoria: 'Prestação de serviços',
      descricao: `NFS-e nº ${nota.numero} · ${nota.tomador_nome}`,
      valor: nota.valor,
      data: nota.data_emissao,
      nota_id: nota.id,
      origem: 'nota',
    })
  }
  return data ?? nota
}

/** Consulta no provedor as notas que ficaram em processamento. */
export async function atualizarNotas(db: any, perfil: any) {
  if (!env('FOCUS_NFE_TOKEN')) return
  const { data } = await db.from('mei_notas').select().eq('user_id', perfil.user_id).eq('status', 'processando')
  for (const nota of data ?? []) {
    const r = await focus('GET', `/v2/nfsen/${nota.id}`)
    const res = resultadoFocus(r.dados)
    if (res.status !== 'processando') await gravar(db, perfil, nota, res)
  }
}

export async function cancelarNota(db: any, perfil: any, id: string, motivo = 'Erro na emissão') {
  const { data: nota } = await db.from('mei_notas').select().eq('id', id).eq('user_id', perfil.user_id).maybeSingle()
  if (!nota) throw new Falha('Nota não encontrada.', 404)
  if (nota.status !== 'emitida') throw new Falha('Só é possível cancelar notas emitidas.')
  if (nota.ambiente === 'producao') {
    const r = await focus('DELETE', `/v2/nfsen/${nota.id}`, { justificativa: motivo.padEnd(15, '.') })
    if (!r.ok) throw new Falha(r.dados.mensagem ?? 'O provedor recusou o cancelamento.')
  }
  await db.from('mei_lancamentos').delete().eq('nota_id', nota.id)
  const { data } = await db.from('mei_notas').update({ status: 'cancelada' }).eq('id', nota.id).select().single()
  return data
}
