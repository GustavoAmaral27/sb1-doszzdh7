import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, logEvent } from '../lib/supabase'

const IDLE_LIMIT_MS = 10 * 60 * 1000 // encerra a sessão após 10 min sem uso

interface AuthState {
  session: Session | null
  loading: boolean
  needsMfa: boolean
  hasMfa: boolean
  privacy: boolean
  togglePrivacy: () => void
  refreshAal: () => Promise<void>
  signOut: (reason?: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [hasMfa, setHasMfa] = useState(false)
  const [privacy, setPrivacy] = useState(() => {
    try {
      return localStorage.getItem('privacy') === '1'
    } catch {
      return false
    }
  })
  const lastActivity = useRef(Date.now())

  const refreshAal = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setHasMfa(data?.nextLevel === 'aal2')
    setNeedsMfa(data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await refreshAal()
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) setTimeout(refreshAal, 0)
      else {
        setNeedsMfa(false)
        setHasMfa(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [refreshAal])

  const signOut = useCallback(async (reason = 'manual') => {
    await logEvent('auth.sign_out', { reason }).then(undefined, () => undefined)
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  // Bloqueio automático por inatividade.
  useEffect(() => {
    if (!session) return
    const touch = () => (lastActivity.current = Date.now())
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) signOut('idle_timeout')
    }, 15_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(timer)
    }
  }, [session, signOut])

  const togglePrivacy = () =>
    setPrivacy((p) => {
      try {
        localStorage.setItem('privacy', p ? '0' : '1')
      } catch {
        /* sem armazenamento: só não lembra a preferência */
      }
      return !p
    })

  return (
    <AuthContext.Provider value={{ session, loading, needsMfa, hasMfa, privacy, togglePrivacy, refreshAal, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
