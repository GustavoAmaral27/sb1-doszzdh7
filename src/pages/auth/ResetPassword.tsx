import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, logEvent } from '../../lib/supabase'
import { passwordProblems } from '../../lib/format'
import { Alert, Button, Input, Label } from '../../components/app/ui'
import AuthShell from './AuthShell'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const problems = passwordProblems(password)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (problems.length) return setError(`A senha precisa ter ${problems.join(', ')}.`)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setError('Não foi possível alterar a senha. Solicite um novo link.')
    await logEvent('auth.password_changed')
    navigate('/')
  }

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha forte que você não use em outros sites.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <Label htmlFor="pw">Nova senha</Label>
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {password && problems.length > 0 && <p className="mt-1.5 text-xs text-amber-700">Falta: {problems.join(', ')}.</p>}
        </div>
        <Button type="submit" className="w-full">Salvar nova senha</Button>
      </form>
    </AuthShell>
  )
}
