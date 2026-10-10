import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, KeyRound, LogOut, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase, logEvent } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import type { AuditEntry } from '../../lib/types'
import { Alert, Button, Card, Input, Label, PageHeader } from '../../components/app/ui'

const ACTIONS: Record<string, string> = {
  'auth.sign_in': 'Login realizado',
  'auth.sign_out': 'Saída da conta',
  'auth.mfa_verified': 'Verificação em 2 etapas confirmada',
  'auth.mfa_enrolled': 'Verificação em 2 etapas ativada',
  'auth.mfa_removed': 'Verificação em 2 etapas desativada',
  'auth.password_changed': 'Senha alterada',
  'auth.global_sign_out': 'Saída de todos os dispositivos',
  'bank.connect_token': 'Conexão bancária iniciada',
  'bank.sync': 'Dados bancários sincronizados',
  'bank.disconnect': 'Banco desconectado',
  'bank.deleted_by_provider': 'Conexão removida pela instituição',
  'security.item_ownership_violation': '⚠️ Tentativa de conexão bloqueada',
}

export default function Security() {
  const { hasMfa, refreshAal, signOut } = useAuth()
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [log, setLog] = useState<AuditEntry[]>([])

  useEffect(() => {
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30).then(({ data }) => setLog(data ?? []))
  }, [hasMfa])

  async function startEnroll() {
    setError(null)
    // Remove cadastros pendentes não verificados antes de começar outro.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of existing?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `App autenticador ${Date.now()}` })
    if (error || !data) return setError('Não foi possível iniciar o cadastro.')
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirmEnroll() {
    if (!enroll) return
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code })
    if (error) return setError('Código inválido. Confira o horário do celular e tente de novo.')
    await logEvent('auth.mfa_enrolled')
    setEnroll(null)
    setCode('')
    setInfo('Pronto! A verificação em 2 etapas está ativa.')
    await refreshAal()
  }

  async function removeMfa() {
    if (!window.confirm('Desativar a verificação em 2 etapas deixa sua conta menos protegida. Continuar?')) return
    const { data } = await supabase.auth.mfa.listFactors()
    for (const f of data?.totp ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id })
    await logEvent('auth.mfa_removed')
    await supabase.auth.refreshSession()
    await refreshAal()
  }

  async function signOutEverywhere() {
    if (!window.confirm('Sair de todos os dispositivos, incluindo este?')) return
    await logEvent('auth.global_sign_out')
    await supabase.auth.signOut({ scope: 'global' })
    await signOut('global')
  }

  const checklist = [
    { ok: true, label: 'Senha forte exigida (12+ caracteres)' },
    { ok: hasMfa, label: 'Verificação em 2 etapas' },
    { ok: true, label: 'Saída automática após 10 min sem uso' },
    { ok: true, label: 'Acesso bancário somente leitura via Open Finance' },
    { ok: true, label: 'Dados isolados por usuário no banco de dados' },
  ]

  return (
    <div>
      <PageHeader title="Segurança" subtitle="Como protegemos sua conta e seus dados financeiros." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {error && <Alert>{error}</Alert>}
          {info && <Alert tone="success">{info}</Alert>}

          <Card>
            <div className="flex items-start gap-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${hasMfa ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {hasMfa ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900">Verificação em 2 etapas</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {hasMfa
                    ? 'Ativa. Além da senha, pedimos um código do seu app autenticador a cada login.'
                    : 'Recomendado. Mesmo que alguém descubra sua senha, não conseguirá entrar sem o código do seu celular.'}
                </p>
                {!enroll && (
                  <div className="mt-4">
                    {hasMfa ? (
                      <Button variant="danger" onClick={removeMfa}>Desativar</Button>
                    ) : (
                      <Button onClick={startEnroll}><Smartphone className="h-4 w-4" /> Ativar agora</Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {enroll && (
              <div className="mt-6 grid gap-6 rounded-2xl bg-slate-50 p-5 md:grid-cols-[auto,1fr]">
                <img src={enroll.qr} alt="QR code para o app autenticador" className="h-44 w-44 rounded-xl bg-white p-2" />
                <div className="space-y-3 text-sm">
                  <ol className="list-decimal space-y-1 pl-4 text-slate-600">
                    <li>Abra o Google Authenticator, Microsoft Authenticator, Authy ou 1Password.</li>
                    <li>Escaneie o QR code (ou digite a chave abaixo).</li>
                    <li>Digite o código de 6 dígitos que aparecer.</li>
                  </ol>
                  <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">{enroll.secret}</p>
                  <div>
                    <Label htmlFor="otp">Código</Label>
                    <div className="flex gap-2">
                      <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                      <Button onClick={confirmEnroll} disabled={code.length !== 6}>Confirmar</Button>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setEnroll(null)}>Cancelar</Button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold text-slate-900">Atividade recente da conta</h2>
            <p className="text-sm text-slate-500">Se algo aqui não foi você, troque sua senha e saia de todos os dispositivos.</p>
            <ul className="mt-4 divide-y divide-slate-100">
              {log.length === 0 && <li className="py-3 text-sm text-slate-400">Sem registros ainda.</li>}
              {log.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className={e.action.startsWith('security.') ? 'font-medium text-red-600' : 'text-slate-700'}>{ACTIONS[e.action] ?? e.action}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-slate-900">Sua proteção</h2>
            <ul className="mt-4 space-y-3">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                  <span className={c.ok ? 'text-slate-700' : 'font-medium text-amber-700'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold text-slate-900">Sessões</h2>
            <Button variant="outline" className="w-full" onClick={async () => {
              const { data } = await supabase.auth.getUser()
              if (data.user?.email) await supabase.auth.resetPasswordForEmail(data.user.email, { redirectTo: `${window.location.origin}/redefinir-senha` })
              setInfo('Enviamos um link para trocar sua senha.')
            }}>
              <KeyRound className="h-4 w-4" /> Trocar senha
            </Button>
            <Button variant="danger" className="w-full" onClick={signOutEverywhere}>
              <LogOut className="h-4 w-4" /> Sair de todos os dispositivos
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
