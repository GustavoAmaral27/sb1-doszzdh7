import { createClient } from '@supabase/supabase-js'

// Chave pública (publishable): pode ficar no app. Os dados são protegidos por RLS,
// cada usuário só enxerga as próprias linhas.
export const SUPABASE_URL = 'https://pnruhfmvzoqhahpyhnaa.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_ve_0fxVx5rvEteBs4hr_qg_57q4Pqyo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'financeiro:auth' },
})
