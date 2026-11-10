import { SUPABASE_KEY, SUPABASE_URL, supabase } from '../lib/supabase'
import { todayISO } from '../lib/utils'

export { supabase }

/** Nome do produto: troque aqui para mudar a marca em todo o sistema. */
export const MARCA = { nome: 'Prumo', destaque: 'MEI' }
/** Limite de faturamento anual do MEI. */
export const LIMITE = 81000

export type Atividade = 'comercio' | 'servico' | 'ambos'
export interface Perfil {
  user_id: string
  email: string
  nome: string
  razao_social: string
  cnpj: string
  atividade: Atividade
  descricao_servico: string
  codigo_servico: string
  municipio: string
  uf: string
  codigo_municipio: string
  tem_empregado: boolean
  onboarded: boolean
  plano: 'trial' | 'ativo' | 'atrasado' | 'cancelado'
  trial_ate: string
  pago_ate: string | null
  whatsapp: string
  whatsapp_codigo: string | null
  criado_em: string
}
export interface Lancamento {
  id: string
  tipo: 'receita' | 'despesa'
  natureza: 'comercio' | 'servico'
  descricao: string
  categoria: string
  valor: number
  data: string
  nota_id: string | null
  origem: string
}
export interface Nota {
  id: string
  numero: number
  token: string
  tomador_nome: string
  tomador_documento: string
  tomador_email: string
  descricao: string
  valor: number
  data_emissao: string
  status: 'processando' | 'emitida' | 'cancelada' | 'erro'
  ambiente: 'simulacao' | 'producao'
  codigo_verificacao: string
  pdf_url: string
  erro: string
  origem: string
}
export interface Cliente {
  id: string
  nome: string
  documento: string
  email: string
  telefone: string
}
export interface Dasn {
  id: string
  user_id: string
  ano: number
  receita_comercio: number
  receita_servico: number
  teve_empregado: boolean
  status: 'solicitada' | 'entregue'
  recibo: string
  obs: string
  solicitada_em: string
  entregue_em: string | null
}

export const ATIVIDADES: Record<Atividade, string> = {
  servico: 'Prestação de serviços',
  comercio: 'Comércio ou indústria',
  ambos: 'Comércio e serviços',
}
export const CATEGORIAS_RECEITA = ['Prestação de serviços', 'Venda de produtos', 'Outras receitas']
export const CATEGORIAS_DESPESA = [
  'Mercadorias e materiais',
  'Aluguel',
  'Contas (luz, água, internet)',
  'Transporte',
  'Marketing',
  'Alimentação',
  'Equipamentos',
  'Taxas e tarifas',
  'Impostos (DAS)',
  'Outros',
]
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

/** Chama a função do servidor (emissão de nota, robô, assinatura). */
export async function api<T = Record<string, unknown>>(acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/mei-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ acao, ...corpo }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.erro ?? 'Não foi possível concluir. Tente de novo.')
  return j as T
}

export async function notaPublica(token: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/mei-api/nota?t=${encodeURIComponent(token)}`, { headers: { apikey: SUPABASE_KEY } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.erro ?? 'Nota não encontrada.')
  return j as { nota: Nota; prestador: Pick<Perfil, 'razao_social' | 'cnpj' | 'municipio' | 'uf'> | null }
}

/** DAS do MEI: 5% do salário mínimo (INSS) + R$ 1 de ICMS e/ou R$ 5 de ISS. */
export function valorDas(salarioMinimo: number, atividade: Atividade) {
  return Math.round(salarioMinimo * 5) / 100 + (atividade === 'comercio' ? 1 : atividade === 'servico' ? 5 : 6)
}

export const acessoLiberado = (p: Perfil) => p.plano === 'ativo' || (p.plano === 'trial' && p.trial_ate >= todayISO())
export const diasAte = (iso: string) => Math.ceil((new Date(iso + 'T12:00:00').getTime() - new Date(todayISO() + 'T12:00:00').getTime()) / 864e5)

export const digitos = (s: string) => (s || '').replace(/\D/g, '')
export function fmtDoc(s: string) {
  const d = digitos(s)
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return s
}
export const urlApp = () => window.location.href.split('#')[0]
export const ir = (rota: string) => {
  window.location.hash = rota
}
