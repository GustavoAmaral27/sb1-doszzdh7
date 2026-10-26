export type CompanyId = 'ztec' | 'amaral' | 'versure'
export type CompanyFilter = CompanyId | 'todas'
export type TxType = 'pagar' | 'receber'
export type TxStatus = 'pendente' | 'vencido' | 'pago'

export interface Transaction {
  id: string
  company: CompanyId
  type: TxType
  description: string
  category: string
  /** Pessoa/empresa: fornecedor (a pagar) ou cliente (a receber) */
  party: string
  amount: number
  /** Datas no formato AAAA-MM-DD */
  dueDate: string
  paid: boolean
  paidDate?: string
  notes?: string
  createdAt: string
  /** Última alteração (ISO). Na sincronização vence a versão mais recente. */
  updatedAt?: string
  /** Excluído: fica guardado só para avisar a nuvem, não aparece no app. */
  deleted?: boolean
}

export interface Settings {
  initialBalance: Record<CompanyId, number>
  updatedAt?: string
}

export const COMPANIES: Record<CompanyId, { name: string; short: string; dot: string }> = {
  ztec: { name: 'Z-TEC Quarteirização Contábil', short: 'Z-TEC', dot: 'bg-violet-600' },
  amaral: { name: 'Amaral Contabilidade', short: 'Amaral', dot: 'bg-teal-600' },
  versure: { name: 'Versure Digital', short: 'Versure', dot: 'bg-amber-500' },
}

export const COMPANY_IDS = Object.keys(COMPANIES) as CompanyId[]

/** Saldo inicial zerado para todas as empresas. */
export const zeroBalances = () => Object.fromEntries(COMPANY_IDS.map((id) => [id, 0])) as Record<CompanyId, number>

export const ALL_COMPANIES_LABEL = 'Consolidado das empresas'

export const CATEGORIES: Record<TxType, string[]> = {
  pagar: [
    'Aluguel',
    'Folha de pagamento',
    'Pró-labore',
    'Distribuição de lucros',
    'Impostos',
    'Energia / Água',
    'Internet / Telefone',
    'Sistemas / Software',
    'Fornecedores',
    'Material de escritório',
    'Marketing',
    'Tarifas bancárias',
    'Empréstimos',
    'Cartão de crédito',
    'Educação',
    'Investimentos',
    'Carro e viagem',
    'Outros',
  ],
  receber: [
    'Honorários mensais',
    'Quarteirização',
    'Abertura de empresa',
    'Serviços avulsos',
    'IRPF',
    'Consultoria',
    'Outros',
  ],
}
