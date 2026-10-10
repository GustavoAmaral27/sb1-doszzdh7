const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatBRL = (n: number) => brl.format(n)

export const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export const today = () => new Date().toISOString().slice(0, 10)

/** Regras mínimas de senha forte (o Supabase também deve ser configurado). */
export function passwordProblems(pw: string): string[] {
  const p: string[] = []
  if (pw.length < 12) p.push('pelo menos 12 caracteres')
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) p.push('letras maiúsculas e minúsculas')
  if (!/\d/.test(pw)) p.push('um número')
  if (!/[^A-Za-z0-9]/.test(pw)) p.push('um símbolo')
  return p
}
