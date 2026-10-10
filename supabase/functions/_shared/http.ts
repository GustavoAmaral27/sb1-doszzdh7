// Utilidades comuns às Edge Functions: CORS restrito, respostas JSON e
// autenticação do usuário (incluindo exigência do segundo fator).
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.45.4'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

/** Valida o JWT do chamador e exige aal2 se o usuário tiver MFA ativo. */
export async function requireUser(req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Não autenticado')

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sessão inválida')

  const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  const hasMfa = (data.user.factors ?? []).some((f) => f.status === 'verified')
  if (hasMfa && claims.aal !== 'aal2') throw new HttpError(403, 'Confirme o segundo fator de autenticação')

  return data.user
}

export async function audit(userId: string | null, action: string, details: Record<string, unknown> = {}) {
  await admin.from('audit_log').insert({ user_id: userId, action, details })
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message }, e.status)
      console.error(e)
      // Nunca vazar detalhes internos para o cliente.
      return json(req, { error: 'Erro interno' }, 500)
    }
  }
}
