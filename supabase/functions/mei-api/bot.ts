// Robô de conversa: o mesmo código atende o WhatsApp e o simulador dentro do app.
// deno-lint-ignore-file no-explicit-any
import { brl, digitos, emitirNota, hojeBR, liberado } from './notas.ts'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const DOC = /(?:\b(?:cpf|cnpj)\s*:?\s*)?(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)/i
const VALOR = /(?:\b(?:no\s+)?valor\s+(?:de\s+)?|\bde\s+)?(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:reais|real|conto|contos|pila))?/i
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function numero(s: string) {
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''))
  return Number(s)
}

/** Tira CPF/CNPJ e valor do texto e devolve o que sobrou. */
export function extrair(texto: string) {
  let resto = texto
  let documento = ''
  let valor = 0
  const d = resto.match(DOC)
  if (d) {
    documento = digitos(d[1])
    resto = resto.replace(d[0], ' ')
  }
  const v = resto.match(VALOR)
  if (v) {
    valor = numero(v[1])
    resto = resto.replace(v[0], ' ')
  }
  return { documento, valor, resto: resto.replace(/\s+/g, ' ').trim() }
}

export function lerNota(texto: string) {
  const { documento, valor, resto } = extrair(texto.replace(/^\s*(?:(?:emitir|emite|emita|gerar|gera|fazer|faz|tirar|quero|preciso de)\s+)?(?:uma\s+)?(?:nota|nfs-?e|nfs|nf)(?:\s+fiscal)?\b/i, ''))
  let tomador = ''
  let descricao = ''
  const para = resto.match(/(?:^|\s)(?:para|pra|p\/)\s+(?:o\s+|a\s+)?(.*)$/i)
  const alvo = para ? para[1] : resto
  const m = alvo.match(/(?:^|\s)(?:referente\s+(?:ao|a|à)|ref\.?|servi[cç]o\s+de|servi[cç]o|pelo|pela|por)\s+/i)
  if (m) {
    tomador = alvo.slice(0, m.index)
    descricao = alvo.slice(m.index! + m[0].length)
  } else {
    const partes = alvo.split(/\s*[,;:]\s*|\s+-\s+/)
    tomador = partes[0]
    descricao = partes.slice(1).join(', ')
  }
  const limpa = (s: string) => s.replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '')
  return { valor, tomador_documento: documento, tomador_nome: limpa(tomador), descricao: limpa(descricao) }
}

const CATEGORIAS: [RegExp, string][] = [
  [/gasolina|combustivel|uber|onibus|frete|estacionamento|pedagio|oficina/, 'Transporte'],
  [/aluguel|condominio/, 'Aluguel'],
  [/luz|energia|agua|internet|telefone|celular/, 'Contas (luz, água, internet)'],
  [/material|mercadoria|estoque|fornecedor|produto|insumo|ingrediente/, 'Mercadorias e materiais'],
  [/anuncio|trafego|marketing|instagram|panfleto/, 'Marketing'],
  [/almoco|lanche|comida|restaurante|mercado/, 'Alimentação'],
  [/maquininha|taxa|tarifa|banco/, 'Taxas e tarifas'],
  [/ferramenta|equipamento|maquina|computador/, 'Equipamentos'],
]

const AJUDA = `Posso fazer isto por você:

🧾 *Nota fiscal* — "nota 150 para Maria Silva, corte de cabelo"
💰 *Entrada* — "recebi 200 pix do João"
💸 *Gasto* — "gastei 50 gasolina"
📊 *Resumo* — "resumo" ou "saldo"
📅 *Imposto* — "das" (e "das pago" quando pagar)
📄 *Últimas notas* — "notas"

Para desistir de uma conversa, mande "cancelar".`

async function resumo(db: any, p: any) {
  const hoje = hojeBR()
  const { data } = await db.from('mei_lancamentos').select('tipo,valor,data').eq('user_id', p.user_id).gte('data', hoje.slice(0, 4) + '-01-01')
  let rec = 0, desp = 0, ano = 0
  for (const l of data ?? []) {
    if (l.tipo === 'receita') ano += Number(l.valor)
    if (l.data.slice(0, 7) !== hoje.slice(0, 7)) continue
    if (l.tipo === 'receita') rec += Number(l.valor)
    else desp += Number(l.valor)
  }
  const pct = Math.round((ano / 81000) * 100)
  return `📊 *${MESES[Number(hoje.slice(5, 7)) - 1]}*\nEntradas: ${brl(rec)}\nSaídas: ${brl(desp)}\nResultado: *${brl(rec - desp)}*\n\nFaturamento no ano: ${brl(ano)} (${pct}% do limite de R$ 81 mil)${pct >= 80 ? '\n⚠️ Atenção: você está perto do limite do MEI.' : ''}`
}

async function das(db: any, p: any, marcarPago: boolean) {
  const hoje = hojeBR()
  const d = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 2, 1)
  const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const nome = `${MESES[d.getMonth()]}/${d.getFullYear()}`
  if (marcarPago) {
    await db.from('mei_das').upsert({ user_id: p.user_id, competencia: comp, pago: true, pago_em: hoje })
    return `✅ DAS de ${nome} marcado como pago.`
  }
  const [{ data: cfg }, { data: pg }] = await Promise.all([
    db.from('mei_config').select('valor').eq('chave', 'salario_minimo').maybeSingle(),
    db.from('mei_das').select('pago').eq('user_id', p.user_id).eq('competencia', comp).maybeSingle(),
  ])
  const valor = Math.round(Number(cfg?.valor ?? 1621) * 5) / 100 + (p.atividade === 'comercio' ? 1 : p.atividade === 'servico' ? 5 : 6)
  return pg?.pago
    ? `✅ O DAS de ${nome} (${brl(valor)}) já está pago.`
    : `📅 DAS de ${nome}: *${brl(valor)}*, vence dia 20/${hoje.slice(5, 7)}.\nGere a guia no app (Impostos) e, depois de pagar, mande "das pago".`
}

function proximaPergunta(n: any) {
  if (!(n.valor > 0)) return { etapa: 'valor', msg: 'Qual o *valor* da nota?' }
  if (!n.tomador_nome) return { etapa: 'tomador', msg: 'Para *quem* é a nota? Mande o nome e, se tiver, o CPF ou CNPJ.\n(ou responda "consumidor" para não identificar)' }
  if (!n.descricao) return { etapa: 'descricao', msg: 'Qual foi o *serviço* prestado?' }
  return {
    etapa: 'confirmar',
    msg: `Confira a nota:\n\n👤 ${n.tomador_nome}${n.tomador_documento ? ' · ' + n.tomador_documento : ''}\n🛠️ ${n.descricao}\n💵 *${brl(n.valor)}*\n\nPosso emitir? Responda *SIM* ou *NÃO*.`,
  }
}

export async function responder(db: any, p: any, texto: string, canal: string, urlApp: string): Promise<string> {
  const reg = (direcao: string, t: string) => db.from('mei_whatsapp_msgs').insert({ user_id: p.user_id, direcao, canal, texto: t.slice(0, 2000) })
  await reg('in', texto)
  const resposta = await pensar(db, p, texto, canal, urlApp).catch((e: any) => `⚠️ ${e?.message ?? 'Algo deu errado. Tente de novo.'}`)
  await reg('out', resposta)
  return resposta
}

async function pensar(db: any, p: any, texto: string, canal: string, urlApp: string): Promise<string> {
  const n = semAcento(texto)
  const chave = p.user_id
  const salvar = (estado: any) => db.from('mei_whatsapp_sessoes').upsert({ chave, estado, atualizado_em: new Date().toISOString() })
  const { data: ses } = await db.from('mei_whatsapp_sessoes').select('estado,atualizado_em').eq('chave', chave).maybeSingle()
  const recente = ses && Date.now() - new Date(ses.atualizado_em).getTime() < 30 * 60e3
  let estado: any = recente ? ses.estado : {}
  const lancamento = /^(recebi|entrou|vendi|receita|ganhei)\b/.test(n) ? 'receita' : /^(gastei|paguei|comprei|despesa|gasto)\b/.test(n) ? 'despesa' : ''
  const pedeDas = /^das\b|\b(o|do|meu|pagar|paguei|quitei)\s+das\b|imposto|guia/.test(n)
  const pedeNota = !lancamento && /^(?:\S+\s+){0,3}(nota|nf|nfs|nfse|nfs-e)\b/.test(n)
  // Um comando novo no meio de uma conversa pendente recomeça do zero.
  if (estado.etapa && (pedeNota || lancamento || /^(das|resumo|saldo|ajuda|menu|notas)\b/.test(n))) {
    estado = {}
    await salvar({})
  }

  if (/^(cancelar|cancela|sair|deixa|esquece)\b/.test(n)) {
    await salvar({})
    return estado.etapa ? 'Tudo bem, cancelei. 👍' : 'Não havia nada em andamento. Mande "ajuda" para ver o que posso fazer.'
  }

  if (estado.etapa) {
    const nota = estado.nota
    if (estado.etapa === 'confirmar') {
      if (/^(sim|s|confirmo|confirma|pode|ok|isso|emite|emitir)\b/.test(n)) {
        await salvar({})
        const r = await emitirNota(db, p, { ...nota, origem: canal })
        if (r.status === 'erro') return `❌ A nota não foi autorizada: ${r.erro}`
        return `✅ Nota nº ${r.numero} ${r.status === 'emitida' ? 'emitida' : 'enviada para autorização'}!\n${nota.tomador_nome} · ${brl(nota.valor)}\n\n${urlApp}#/n/${r.token}${r.ambiente === 'simulacao' ? '\n\n(modo de teste: sem valor fiscal)' : ''}`
      }
      if (/^(nao|n|negativo|errado)\b/.test(n)) {
        await salvar({})
        return 'Certo, não emiti. Se quiser, mande os dados de novo.'
      }
      return 'Responda *SIM* para emitir ou *NÃO* para cancelar.'
    }
    if (estado.etapa === 'valor') nota.valor = extrair(texto).valor
    else if (estado.etapa === 'tomador') {
      const d = texto.match(DOC)
      const anonimo = /^(consumidor|sem|nao)\b/.test(n)
      nota.tomador_documento = d && !anonimo ? digitos(d[1]) : ''
      nota.tomador_nome = anonimo ? 'Consumidor não identificado' : (d ? texto.replace(d[0], ' ') : texto).replace(/\s+/g, ' ').replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '')
    } else if (estado.etapa === 'descricao') nota.descricao = texto.trim()
    const prox = proximaPergunta(nota)
    await salvar({ etapa: prox.etapa, nota })
    return prox.msg
  }

  if (/^(notas|minhas notas|ultimas notas)\b/.test(n)) {
    const { data } = await db.from('mei_notas').select('numero,tomador_nome,valor,status').eq('user_id', p.user_id).order('numero', { ascending: false }).limit(5)
    if (!data?.length) return 'Você ainda não emitiu nenhuma nota. Experimente: "nota 150 para Maria Silva, corte de cabelo".'
    return '📄 *Últimas notas*\n' + data.map((x: any) => `nº ${x.numero} · ${x.tomador_nome} · ${brl(x.valor)}${x.status !== 'emitida' ? ` (${x.status})` : ''}`).join('\n')
  }
  if (pedeNota) {
    if (!liberado(p)) return '🔒 Sua assinatura não está ativa. Regularize no app, em Conta, para voltar a emitir notas.'
    const nota = lerNota(texto)
    if (!nota.descricao && p.descricao_servico) nota.descricao = p.descricao_servico
    const prox = proximaPergunta(nota)
    await salvar({ etapa: prox.etapa, nota })
    return prox.msg
  }
  if (pedeDas) return await das(db, p, /pago|paguei|quitei/.test(n))
  if (/^(resumo|saldo|como estou|quanto|faturamento|limite)\b/.test(n)) return await resumo(db, p)

  const tipo = lancamento
  if (tipo) {
    const e = extrair(texto.replace(/^\s*\S+\s*/, ''))
    if (!(e.valor > 0)) return 'Não entendi o valor. Exemplo: "gastei 50 gasolina" ou "recebi 200 pix do João".'
    const descricao = e.resto.replace(/^(?:(?:de|do|da|com|em|no|na|pix)\s+)+/i, '').trim() || (tipo === 'receita' ? 'Recebimento' : 'Despesa')
    const categoria = tipo === 'receita' ? (p.atividade === 'comercio' ? 'Venda de produtos' : 'Prestação de serviços') : (CATEGORIAS.find(([re]) => re.test(n))?.[1] ?? 'Outros')
    const { error } = await db.from('mei_lancamentos').insert({
      user_id: p.user_id, tipo, natureza: p.atividade === 'comercio' ? 'comercio' : 'servico', descricao: descricao.charAt(0).toUpperCase() + descricao.slice(1), categoria, valor: e.valor, data: hojeBR(), origem: canal,
    })
    if (error) throw new Error('Não consegui salvar o lançamento.')
    return `${tipo === 'receita' ? '💰 Entrada' : '💸 Gasto'} de *${brl(e.valor)}* ${tipo === 'receita' ? 'anotada' : 'anotado'} em ${categoria}.`
  }
  if (/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|menu|help|comandos|\?)/.test(n)) return `Olá${p.nome ? ', ' + p.nome.split(' ')[0] : ''}! 👋\n${AJUDA}`
  return `Não entendi. 🤔\n${AJUDA}`
}
