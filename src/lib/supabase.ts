import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// A sessão fica em sessionStorage: some ao fechar a aba, reduzindo o risco
// de alguém reabrir o navegador e encontrar o app logado.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (error) {
    let message = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) message = (await ctx.json()).error ?? message
    } catch {
      /* mantém a mensagem original */
    }
    throw new Error(message)
  }
  return data as T
}

export function logEvent(action: string, details: Record<string, unknown> = {}) {
  return supabase.rpc('log_event', { p_action: action, p_details: details })
}
