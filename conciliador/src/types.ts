/** Valores sempre em centavos (inteiros), para não errar soma com casas decimais. */
export type Cents = number

/** Uma linha do razão do Domínio. */
export interface LedgerEntry {
  /** Código reduzido da conta no Domínio */
  account: string
  date: string // AAAA-MM-DD
  history: string
  debit: Cents
  credit: Cents
  counterpart?: string
  batch?: string
}

export interface LedgerAccount {
  code: string
  classification: string // ex.: 1.1.1.02.001 (vazio se o relatório não trouxer)
  name: string
  /** Saldo anterior: positivo = devedor, negativo = credor */
  openingBalance: Cents
  entries: LedgerEntry[]
}

/** Movimento do extrato bancário. amount > 0 é entrada de dinheiro. */
export interface BankTxn {
  id: string
  date: string
  amount: Cents
  memo: string
}

export interface BankStatement {
  bankId: string
  acctId: string
  start: string
  end: string
  /** Saldo final informado pelo banco, quando o arquivo traz */
  balance?: Cents
  txns: BankTxn[]
}

/** Lançamento novo a importar no Domínio. */
export interface NewEntry {
  /** Chave única da origem: impede importar o mesmo movimento duas vezes */
  key: string
  date: string
  debit: string
  credit: string
  amount: Cents
  history: string
  /** false = foi para a conta transitória por falta de regra */
  classified: boolean
}

export interface Rule {
  /** Expressão regular testada no histórico do extrato (sem diferenciar maiúsculas) */
  match: string
  /** Conta de contrapartida (código reduzido) */
  account: string
  /** Limita a regra a entradas ou saídas; sem isso vale para as duas */
  direction?: 'entrada' | 'saida'
}

export interface CompanyConfig {
  cnpj: string
  name: string
  /** Conta "a classificar": recebe o que nenhuma regra explicou */
  transitAccount: string
  bankAccounts: { ledgerAccount: string; bankId?: string; acctId: string }[]
  rules?: Rule[]
  /** Dias de diferença aceitos entre extrato e contabilidade (padrão 3) */
  dateWindowDays?: number
  /** Classificações conciliadas na composição de saldo (padrão ["1","2"]: ativo e passivo) */
  reconcilePrefixes?: string[]
  /** Item em aberto há mais dias que isso é destacado (padrão 90) */
  staleDays?: number
}

export interface Issue {
  kind:
    | 'sem_regra'
    | 'contabil_sem_extrato'
    | 'saldo_banco_diverge'
    | 'saldo_invertido'
    | 'item_antigo'
    | 'extrato_sem_conta'
    | 'razao_inconsistente'
  account?: string
  date?: string
  amount?: Cents
  detail: string
}

export interface OpenItem {
  /** Vazio quando o item é o saldo anterior */
  date: string
  history: string
  /** positivo = débito em aberto, negativo = crédito em aberto */
  amount: Cents
}

export interface AccountComposition {
  account: string
  name: string
  balance: Cents
  matched: number
  open: OpenItem[]
}
