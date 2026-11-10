import { useEffect, useState } from 'react'
import { uid } from '../lib/utils'

/** Nome do produto: troque aqui para mudar a marca em todo o sistema. */
export const MARCA = { nome: 'Carteira', destaque: 'MEI' }

export type Atividade = 'comercio' | 'servico' | 'ambos'

export interface Mei {
  id: string
  nome: string
  cnpj: string
  atividade: Atividade
  telefone: string
  /** Honorário mensal cobrado pelo escritório. */
  mensalidade: number
  ativo: boolean
}

export interface Dados {
  meis: Mei[]
  /** Chaves "idDoMei:AAAA-MM". */
  dasPago: Record<string, boolean>
  mensRecebida: Record<string, boolean>
  faturamento: Record<string, number>
  /** Chaves "idDoMei:AAAA" (ano-calendário da declaração). */
  dasnEntregue: Record<string, boolean>
  salarioMinimo: number
}

/** Limite de faturamento anual do MEI. */
export const LIMITE_ANUAL = 81000
export const ATIVIDADES: Record<Atividade, string> = {
  comercio: 'Comércio/Indústria',
  servico: 'Serviços',
  ambos: 'Comércio e Serviços',
}

const VAZIO: Dados = { meis: [], dasPago: {}, mensRecebida: {}, faturamento: {}, dasnEntregue: {}, salarioMinimo: 1621 }
const CHAVE = 'contadores:dados'

/** DAS do MEI: 5% do salário mínimo (INSS) + R$ 1 de ICMS e/ou R$ 5 de ISS. */
export function valorDas(salarioMinimo: number, atividade: Atividade) {
  const fixo = atividade === 'comercio' ? 1 : atividade === 'servico' ? 5 : 6
  return Math.round(salarioMinimo * 5) / 100 + fixo
}

export function faturamentoAno(d: Dados, id: string, ano: string) {
  let total = 0
  for (const [k, v] of Object.entries(d.faturamento)) if (k.startsWith(`${id}:${ano}-`)) total += v
  return total
}

export function carregar(): Dados {
  try {
    const raw = localStorage.getItem(CHAVE)
    if (raw) return { ...VAZIO, ...JSON.parse(raw) }
  } catch {
    /* dados corrompidos: começa do zero */
  }
  return VAZIO
}

export function useDados() {
  const [dados, setDados] = useState<Dados>(carregar)
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(dados))
    } catch {
      /* armazenamento indisponível */
    }
  }, [dados])
  return [dados, setDados] as const
}

export const novoMei = (): Mei => ({ id: uid(), nome: '', cnpj: '', atividade: 'servico', telefone: '', mensalidade: 0, ativo: true })

/** Carteira fictícia para conhecer o painel. */
export function dadosExemplo(mesAtual: string): Dados {
  const base: [string, Atividade, number, number][] = [
    ['Ana Souza Confeitaria', 'comercio', 120, 3200],
    ['Bruno Lima Elétrica', 'servico', 150, 4300],
    ['Carla Mendes Estética', 'servico', 150, 3900],
    ['Diego Rocha Fretes', 'servico', 180, 6400],
    ['Elaine Costa Moda', 'comercio', 120, 2900],
    ['Fábio Nunes Marcenaria', 'ambos', 200, 5200],
    ['Gisele Prado Fotografia', 'servico', 150, 2800],
    ['Hugo Farias Informática', 'ambos', 180, 4100],
  ]
  const [ano, mes] = mesAtual.split('-').map(Number)
  const d: Dados = { ...VAZIO, dasPago: {}, mensRecebida: {}, faturamento: {}, dasnEntregue: {}, meis: [] }
  base.forEach(([nome, atividade, mensalidade, fat], i) => {
    const id = `ex${i}`
    d.meis.push({
      id,
      nome,
      atividade,
      mensalidade,
      ativo: true,
      cnpj: `00.000.00${i}/0001-0${i}`,
      telefone: '',
    })
    for (let m = 1; m <= mes; m++) {
      const k = `${id}:${ano}-${String(m).padStart(2, '0')}`
      d.faturamento[k] = Math.round(fat * (0.85 + ((i * 7 + m * 3) % 10) / 30))
      if (m < mes || i % 3 !== 0) d.dasPago[k] = true
      if (m < mes || i % 4 !== 1) d.mensRecebida[k] = true
    }
    if (i % 5 !== 2) d.dasnEntregue[`${id}:${ano - 1}`] = true
  })
  return d
}
