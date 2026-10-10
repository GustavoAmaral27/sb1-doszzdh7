import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase, logEvent } from '../../lib/supabase'
import { Alert, Button, Input, Label } from '../../components/app/ui'
import AuthShell from './AuthShell'

export default function MfaChallenge() {
  const { refreshAal, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp.find((f) => f.status === 'verified')
    if (!factor) {
      setError('Nenhum fator encontrado.')
      setBusy(false)
      return
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (error) {
      setError('Código inválido ou expirado.')
      setCode('')
    } else {
      await logEvent('auth.mfa_verified')
      await refreshAal()
    }
    setBusy(false)
  }

  return (
    <AuthShell title="Verificação em 2 etapas" subtitle="Abra seu app autenticador e digite o código de 6 dígitos.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-2xl tracking-[0.5em]"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Verificar</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => signOut('mfa_cancel')}>Usar outra conta</Button>
      </form>
    </AuthShell>
  )
}
