import { useState, type FormEvent } from 'react'
import { Cloud, LogOut, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store'

/** Login para sincronizar os lançamentos com a nuvem. */
export default function CloudAccount() {
  const { session, syncState, lastSync, syncNow } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e: FormEvent, mode: 'entrar' | 'criar') {
    e.preventDefault()
    if (!email.trim() || password.length < 6) return setMsg('Informe o e-mail e uma senha com pelo menos 6 caracteres.')
    if (!navigator.onLine) return setMsg('Conecte-se à internet para entrar.')
    setBusy(true)
    setMsg('')
    const creds = { email: email.trim(), password }
    const { data, error } =
      mode === 'entrar' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds)
    setBusy(false)
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('invalid login')) return setMsg('E-mail ou senha incorretos.')
      if (m.includes('not confirmed')) return setMsg('Confirme o e-mail pelo link que enviamos e toque em Entrar de novo.')
      if (m.includes('already registered')) return setMsg('Este e-mail já tem conta. Toque em Entrar.')
      return setMsg('Não foi possível entrar agora. Tente de novo.')
    }
    if (mode === 'criar' && !data.session) setMsg('Conta criada. Abra o e-mail de confirmação, toque no link e depois volte aqui e toque em Entrar.')
  }

  if (session) {
    const hora = lastSync ? new Date(lastSync).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'ainda não'
    return (
      <section className="card space-y-3">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="min-w-0">
            <h3 className="font-bold">Sincronização ligada</h3>
            <p className="truncate text-xs text-slate-500">{session.user.email}</p>
            <p className="mt-1 text-xs text-slate-500">
              Funciona sem internet: tudo fica salvo no celular e é enviado para a nuvem quando a conexão voltar. Última sincronização: {hora}.
            </p>
            {syncState === 'erro' && <p className="mt-1 text-xs font-semibold text-red-600">A última tentativa falhou. Tente de novo.</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={syncNow} disabled={syncState === 'sincronizando'}>
            <RefreshCw className="h-4 w-4" /> Sincronizar
          </button>
          <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card space-y-3">
      <div>
        <h3 className="flex items-center gap-2 font-bold">
          <Cloud className="h-5 w-5 text-blue-600" /> Sincronizar com a nuvem
        </h3>
        <p className="text-xs text-slate-500">
          Entre com seu e-mail para os lançamentos ficarem guardados na nuvem e chegarem sozinhos neste celular. Só você vê os seus dados.
        </p>
      </div>
      <form className="space-y-2" onSubmit={(e) => submit(e, 'entrar')}>
        <input id="cloud-email" className="input" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input id="cloud-pass" className="input" type="password" autoComplete="current-password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {msg && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{msg}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost" disabled={busy} onClick={(e) => submit(e, 'criar')}>Criar conta</button>
          <button type="submit" className="btn-primary" disabled={busy}>Entrar</button>
        </div>
      </form>
    </section>
  )
}
