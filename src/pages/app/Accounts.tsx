import { useState } from 'react'
import { PluggyConnect } from 'react-pluggy-connect'
import { CreditCard, Landmark, Lock, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'
import { callFunction } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import Money from '../../components/app/Money'
import { Alert, Button, Card, Empty, PageHeader } from '../../components/app/ui'

const STATUS: Record<string, [string, string]> = {
  UPDATED: ['Atualizado', 'bg-emerald-50 text-emerald-700'],
  UPDATING: ['Atualizando', 'bg-sky-50 text-sky-700'],
  LOGIN_ERROR: ['Reconectar', 'bg-red-50 text-red-700'],
  OUTDATED: ['Desatualizado', 'bg-amber-50 text-amber-700'],
  WAITING_USER_INPUT: ['Ação necessária', 'bg-amber-50 text-amber-700'],
  ERROR: ['Erro', 'bg-red-50 text-red-700'],
}

export default function Accounts() {
  const { accounts, connections, reload } = useFinance()
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [updateItem, setUpdateItem] = useState<string | undefined>()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function openConnect(itemId?: string) {
    setError(null)
    setBusy(itemId ?? 'new')
    try {
      const { accessToken } = await callFunction<{ accessToken: string }>('pluggy-connect-token', itemId ? { itemId } : {})
      setUpdateItem(itemId)
      setConnectToken(accessToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível iniciar a conexão.')
    } finally {
      setBusy(null)
    }
  }

  async function sync(itemId: string) {
    setBusy(itemId)
    setError(null)
    try {
      const r = await callFunction<{ institution: string; accounts: number }>('pluggy-sync', { itemId })
      setInfo(`${r.institution}: ${r.accounts} conta(s) sincronizada(s).`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao sincronizar.')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(itemId: string, name: string) {
    if (!window.confirm(`Desconectar ${name}? O consentimento será revogado e os dados importados serão apagados.`)) return
    setBusy(itemId)
    try {
      await callFunction('pluggy-sync', { itemId, action: 'delete' })
      setInfo(`${name} foi desconectado.`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao desconectar.')
    } finally {
      setBusy(null)
    }
  }

  const banks = accounts.filter((a) => a.type !== 'credit_card')
  const cards = accounts.filter((a) => a.type === 'credit_card')

  return (
    <div>
      <PageHeader
        title="Contas e cartões"
        subtitle="Conectados pelo Open Finance Brasil, regulado pelo Banco Central."
        action={
          <Button onClick={() => openConnect()} disabled={busy === 'new'}>
            <Plus className="h-4 w-4" /> Conectar banco
          </Button>
        }
      />

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          updateItem={updateItem}
          includeSandbox={import.meta.env.DEV}
          onSuccess={async ({ item }) => {
            setConnectToken(null)
            await sync(item.id)
          }}
          onError={({ message }) => setError(`Conexão falhou: ${message}`)}
          onClose={() => setConnectToken(null)}
        />
      )}

      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}

        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          <p>
            <strong>Acesso somente leitura.</strong> Você autoriza no próprio app do seu banco; nunca vemos nem guardamos sua senha bancária, e
            ninguém consegue fazer pagamentos ou transferências por aqui. Você pode revogar o acesso a qualquer momento.
          </p>
        </div>

        <Card>
          <h2 className="font-semibold text-slate-900">Instituições conectadas</h2>
          {connections.length === 0 ? (
            <Empty icon={<Landmark className="h-6 w-6" />} title="Nenhum banco conectado">
              Conecte sua conta para importar saldos, faturas e transações automaticamente.
            </Empty>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {connections.map((c) => {
                const [label, cls] = STATUS[c.status] ?? [c.status, 'bg-slate-100 text-slate-600']
                const needsReconnect = ['LOGIN_ERROR', 'OUTDATED', 'WAITING_USER_INPUT', 'ERROR'].includes(c.status)
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                    {c.institution_logo ? (
                      <img src={c.institution_logo} alt="" className="h-10 w-10 rounded-full border border-slate-100 object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><Landmark className="h-5 w-5 text-slate-500" /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{c.institution_name}</p>
                      <p className="text-xs text-slate-500">
                        {c.last_synced_at ? `Atualizado em ${formatDateTime(c.last_synced_at)}` : 'Aguardando primeira sincronização'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => (needsReconnect ? openConnect(c.item_id) : sync(c.item_id))} disabled={busy === c.item_id} aria-label="Atualizar">
                        <RefreshCw className={`h-4 w-4 ${busy === c.item_id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button variant="ghost" onClick={() => disconnect(c.item_id, c.institution_name)} disabled={busy === c.item_id} aria-label="Desconectar">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Landmark className="h-5 w-5 text-emerald-600" /> Contas</h2>
            {banks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nenhuma conta ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {banks.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-500">
                        {a.institution_name} · {a.type === 'savings' ? 'Poupança' : 'Conta corrente'} {a.number_masked}
                      </p>
                    </div>
                    <Money value={a.balance} className="font-semibold text-slate-900" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><CreditCard className="h-5 w-5 text-emerald-600" /> Cartões de crédito</h2>
            {cards.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nenhum cartão ainda.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {cards.map((c) => (
                  <li key={c.id} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-4 text-white">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/20" />
                    <p className="text-xs text-slate-300">{c.institution_name}</p>
                    <p className="font-semibold">{c.name}</p>
                    <p className="mt-3 font-mono text-sm tracking-widest text-slate-300">{c.number_masked}</p>
                    <div className="mt-3 flex justify-between text-xs">
                      <div>
                        <p className="text-slate-400">Fatura atual</p>
                        <Money value={c.balance} className="text-base font-semibold" />
                      </div>
                      {c.available_credit !== null && (
                        <div className="text-right">
                          <p className="text-slate-400">Disponível</p>
                          <Money value={Number(c.available_credit)} className="text-base font-semibold text-emerald-300" />
                        </div>
                      )}
                    </div>
                    {c.bill_due_day && <p className="mt-2 text-xs text-slate-400">Vence todo dia {c.bill_due_day}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" /> Conexão via Pluggy, instituição autorizada no ecossistema Open Finance.
        </p>
      </div>
    </div>
  )
}
