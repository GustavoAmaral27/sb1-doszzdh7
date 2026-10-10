// Interpretador de mensagens em português no estilo "assessor no WhatsApp".
// Determinístico de propósito: nenhum dado financeiro sai para terceiros.

export type Intent =
  | { type: 'transaction'; kind: 'expense' | 'income'; amount: number; description: string; category: string; date: string }
  | { type: 'summary'; period: 'today' | 'week' | 'month'; category?: string }
  | { type: 'balance' }
  | { type: 'help' }
  | { type: 'unknown' }

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ['Mercado', /mercado|supermercado|feira|hortifruti|atacad|assa[ií]|carrefour|p[aã]o de a[cç]/],
  ['Alimentação', /ifood|restaurante|lanche|almo[cç]o|jantar|caf[eé]|pizza|hamb[uú]rguer|padaria|comida|rappi|bar\b|cerveja|a[cç]a[ií]/],
  ['Transporte', /uber|\b99\b|t[aá]xi|gasolina|combust[ií]vel|[oô]nibus|metr[oô]|estacionamento|ped[aá]gio|posto|passagem/],
  ['Moradia', /aluguel|condom[ií]nio|luz|energia|[aá]gua|g[aá]s|iptu|internet|reforma/],
  ['Saúde', /farm[aá]cia|rem[eé]dio|m[eé]dico|consulta|exame|dentista|plano de sa[uú]de|academia|hospital/],
  ['Educação', /curso|faculdade|escola|livro|mensalidade|material escolar/],
  ['Lazer', /cinema|show|viagem|passeio|hotel|ingresso|jogo|festa/],
  ['Assinaturas', /netflix|spotify|assinatura|prime|disney|hbo|max\b|youtube|icloud|chatgpt/],
  ['Compras', /t[eê]nis|roupa|sapato|shopping|amazon|mercado livre|shopee|presente|eletr[oô]nico/],
  ['Contas', /conta|boleto|fatura|celular|telefone|tarifa|imposto|ipva/],
  ['Salário', /sal[aá]rio|pagamento|holerite|pro.?labore/],
  ['Investimentos', /dividendo|rendimento|juros|investimento|cdb|tesouro/],
]

const EXPENSE_VERBS = /\b(gastei|paguei|comprei|torrei|saiu|gasto|despesa|pagar|paguei)\b/
const INCOME_VERBS = /\b(recebi|ganhei|entrou|caiu|receita|vendi|depositaram|me pagaram)\b/

function parseAmount(text: string): number | null {
  const m = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(mil|k)?(?:\s*(?:reais|real|conto|pila))?/)
  if (!m) return null
  let raw = m[1]
  if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '')
  let n = Number.parseFloat(raw)
  if (m[2]) n *= 1000
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null
}

function parseDate(text: string, today: Date): string {
  const d = new Date(today)
  if (/anteontem/.test(text)) d.setDate(d.getDate() - 2)
  else if (/ontem/.test(text)) d.setDate(d.getDate() - 1)
  else {
    const m = text.match(/\bdia (\d{1,2})(?:\/(\d{1,2}))?\b/) ?? text.match(/\b(\d{1,2})\/(\d{1,2})\b/)
    if (m) {
      const day = Number(m[1])
      const month = m[2] ? Number(m[2]) - 1 : d.getMonth()
      const candidate = new Date(d.getFullYear(), month, day)
      if (candidate.getDate() === day && candidate <= today) return candidate.toISOString().slice(0, 10)
    }
  }
  return d.toISOString().slice(0, 10)
}

export function guessCategory(text: string, kind: 'expense' | 'income'): string {
  const found = CATEGORY_KEYWORDS.find(([, re]) => re.test(text))?.[0]
  const incomeCats = ['Salário', 'Investimentos']
  if (kind === 'income') return found && incomeCats.includes(found) ? found : 'Outras receitas'
  return found && !incomeCats.includes(found) ? found : 'Outros'
}

function describe(original: string): string {
  const cleaned = original
    .replace(/(?:r\$\s*)?\d[\d.,]*\s*(mil|k)?\s*(reais|real|conto|pila)?/i, ' ')
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrou|caiu|hoje|ontem|anteontem|com|de|no|na|em|do|da|um|uma|o|a|por|pra|para)\b/gi, ' ')
    .replace(/\bdia \d{1,2}(\/\d{1,2})?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const d = cleaned || original.trim()
  return (d.charAt(0).toUpperCase() + d.slice(1)).slice(0, 200)
}

export function parseMessage(input: string, today = new Date()): Intent {
  const text = input.toLowerCase().normalize('NFC').trim()
  if (!text) return { type: 'unknown' }

  if (/^(ajuda|help|menu|oi|ol[aá]|bom dia|boa tarde|boa noite|\/start)\b/.test(text)) return { type: 'help' }
  if (/\bsaldo\b|quanto (eu )?tenho/.test(text)) return { type: 'balance' }

  if (/quanto (eu )?gastei|resumo|relat[oó]rio|extrato|meus gastos|gastos (do|da|de|com|esse|este|nesse|neste)/.test(text)) {
    const period = /hoje/.test(text) ? 'today' : /semana/.test(text) ? 'week' : 'month'
    const cat = CATEGORY_KEYWORDS.find(([, re]) => re.test(text.replace(/quanto (eu )?gastei|resumo|relat[oó]rio|extrato/, '')))?.[0]
    return { type: 'summary', period, category: cat }
  }

  const amount = parseAmount(text)
  if (amount !== null) {
    const kind = INCOME_VERBS.test(text) || (!EXPENSE_VERBS.test(text) && /sal[aá]rio|dividendo|rendimento/.test(text)) ? 'income' : 'expense'
    return {
      type: 'transaction',
      kind,
      amount,
      description: describe(input),
      category: guessCategory(text.replace(/(?:r\$\s*)?\d[\d.,]*/g, ' '), kind),
      date: parseDate(text, today),
    }
  }
  return { type: 'unknown' }
}
