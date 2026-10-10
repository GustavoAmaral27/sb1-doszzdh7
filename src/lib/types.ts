export type Kind = 'expense' | 'income'

export interface Category {
  id: string
  user_id: string | null
  name: string
  kind: Kind
  icon: string
  color: string
}

export interface Account {
  id: string
  connection_id: string | null
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash'
  name: string
  institution_name: string | null
  number_masked: string | null
  balance: number
  credit_limit: number | null
  available_credit: number | null
  bill_due_day: number | null
}

export interface Connection {
  id: string
  item_id: string
  institution_name: string
  institution_logo: string | null
  status: string
  last_synced_at: string | null
}

export interface Transaction {
  id: string
  account_id: string | null
  category_id: string | null
  description: string
  amount: number
  kind: Kind
  occurred_on: string
  source: 'manual' | 'assessor' | 'open_finance'
}

export interface Budget {
  id: string
  category_id: string
  monthly_limit: number
}

export interface AssessorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface AuditEntry {
  id: number
  action: string
  details: Record<string, unknown>
  created_at: string
}
