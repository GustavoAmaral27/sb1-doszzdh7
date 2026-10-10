import { useState, type FormEvent } from 'react'
import { supabase, logEvent } from '../../lib/supabase'
import { passwordProblems } from '../../lib/format'
import { Alert, Button, Input, Label } from '../../components/app/ui'
import AuthShell from './AuthShell'

type Mode = 'signin' | 'signup' | 'forgot'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const problems = mode === 'signup' ? passwordProblems(password) : []

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        // Mensagem genérica: não revela se o e-mail existe.
        if (error) throw new Error('E-mail ou senha incorretos.')
        await logEvent('auth.sign_in')
      } else if (mode === 'signup') {
        if (problems.length) throw new Error(`A senha precisa ter ${problems.join(', ')}.`)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim().slice(0, 120) }, emailRedirectTo: window.location.origin },
        })
        if (error) throw new Error(error.message)
        setInfo('Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.')
        setMode('signin')
      } else {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })
        setInfo('Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.')
        setMode('signin')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setBusy(false)
      setPassword('')
    }
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ['Bem-vindo de volta', 'Entre para ver suas finanças.'],
    signup: ['Crie sua conta', 'Leva menos de um minuto.'],
    forgot: ['Recuperar acesso', 'Informe seu e-mail para receber um link.'],
  }

  return (
    <AuthShell title={titles[mode][0]} subtitle={titles[mode][1]}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        {mode === 'signup' && (
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </div>
        )}
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {mode !== 'forgot' && (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              {mode === 'signin' && (
                <button type="button" onClick={() => setMode('forgot')} className="mb-1.5 text-xs font-medium text-emerald-700 hover:underline">
                  Esqueci a senha
                </button>
              )}
            </div>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === 'signup' && password && problems.length > 0 && (
              <p className="mt-1.5 text-xs text-amber-700">Falta: {problems.join(', ')}.</p>
            )}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        {mode === 'signin' ? (
          <>Ainda não tem conta? <button onClick={() => setMode('signup')} className="font-semibold text-emerald-700 hover:underline">Cadastre-se</button></>
        ) : (
          <button onClick={() => setMode('signin')} className="font-semibold text-emerald-700 hover:underline">Voltar para o login</button>
        )}
      </p>
    </AuthShell>
  )
}
