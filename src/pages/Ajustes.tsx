import { useRef, useState } from 'react'
import { Cloud, Download, HardDrive, Smartphone, Trash2, Upload } from 'lucide-react'
import ConfirmButton from '../components/ConfirmButton'
import { useStore } from '../store'
import { COMPANIES, COMPANY_IDS, type CompanyId, type Settings, type Transaction } from '../types'
import { money, parseMoney, todayISO } from '../lib/utils'

const fmtBalance = (v: number) => v.toFixed(2).replace('.', ',')

export default function Ajustes() {
  const { settings, setSettings, transactions, replaceAll, addMany, mode } = useStore()
  const [balances, setBalances] = useState<Record<CompanyId, string>>(() => ({
    ztec: fmtBalance(settings.initialBalance.ztec),
    amaral: fmtBalance(settings.initialBalance.amaral),
  }))
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<{ transactions: Transaction[]; settings?: Settings } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function saveBalances() {
    const initialBalance = { ...settings.initialBalance }
    for (const id of COMPANY_IDS) initialBalance[id] = parseMoney(balances[id]) || 0
    setSettings({ ...settings, initialBalance })
    setMsg('Saldos iniciais salvos.')
  }

  async function exportBackup() {
    const filename = `financeiro-backup-${todayISO()}.json`
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), transactions, settings }, null, 2)
    const downloads = window.claude ? await window.claude.use('downloads').catch(() => null) : null
    if (downloads) {
      try {
        await downloads.save({ filename, data })
        setMsg('Backup exportado.')
      } catch (e) {
        if ((e as { code?: string }).code !== 'declined') setMsg('Não foi possível exportar o backup aqui.')
      }
      return
    }
    // No celular, abre o menu de compartilhar (WhatsApp, Drive, e-mail…) quando disponível.
    const file = new File([data], filename, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Backup Financeiro' })
        setMsg('Backup exportado.')
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setMsg('Não foi possível compartilhar o backup.')
      }
      return
    }
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function readBackup(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { transactions?: Transaction[]; settings?: Settings }
      if (!Array.isArray(data.transactions)) throw new Error()
      setPending({ transactions: data.transactions, settings: data.settings })
      setMsg('')
    } catch {
      setMsg('Arquivo de backup inválido.')
    }
  }

  /** Soma os lançamentos do arquivo aos atuais, sem repetir os que já existem. */
  function addToCurrent() {
    if (!pending) return
    const existing = new Set(transactions.map((t) => t.id))
    const novos = pending.transactions.filter((t) => !existing.has(t.id))
    setPending(null)
    addMany(novos)
    const repetidos = pending.transactions.length - novos.length
    setMsg(`${novos.length} lançamento(s) adicionado(s).${repetidos ? ` ${repetidos} já existia(m) e foi(ram) ignorado(s).` : ''}`)
  }

  async function restore() {
    if (!pending) return
    const data = pending
    setPending(null)
    setMsg('Restaurando…')
    await replaceAll(data)
    if (data.settings) {
      setBalances({ ztec: fmtBalance(data.settings.initialBalance.ztec), amaral: fmtBalance(data.settings.initialBalance.amaral) })
    }
    setMsg('Backup restaurado.')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Ajustes</h2>
      {msg && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">{msg}</p>}

      <section className="card flex items-start gap-3">
        {mode === 'nuvem' ? <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /> : <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />}
        <div>
          <h3 className="font-bold">{mode === 'nuvem' ? 'Dados salvos na nuvem' : mode === 'local' ? 'Dados salvos neste aparelho' : 'Conectando…'}</h3>
          <p className="text-xs text-slate-500">
            {mode === 'nuvem'
              ? 'Seus lançamentos ficam guardados na sua conta Claude e aparecem em qualquer aparelho em que você abrir o app logado.'
              : 'Funciona sem internet. Os lançamentos ficam guardados só neste celular: exporte um backup de vez em quando para não perder nada se trocar de aparelho.'}
          </p>
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h3 className="font-bold">Saldo inicial em caixa</h3>
          <p className="text-xs text-slate-500">Quanto cada empresa tinha em conta/caixa antes do primeiro lançamento no app.</p>
        </div>
        {COMPANY_IDS.map((id) => (
          <div key={id}>
            <label className="label" htmlFor={`bal-${id}`}>{COMPANIES[id].name}</label>
            <input
              id={`bal-${id}`}
              className="input"
              inputMode="decimal"
              value={balances[id]}
              onChange={(e) => setBalances((b) => ({ ...b, [id]: e.target.value }))}
            />
          </div>
        ))}
        <p className="text-xs text-slate-500">Atual: {COMPANY_IDS.map((id) => `${COMPANIES[id].short} ${money(settings.initialBalance[id])}`).join(' · ')}</p>
        <button className="btn-primary w-full" onClick={saveBalances}>Salvar saldos</button>
      </section>

      <section className="card space-y-3">
        <div>
          <h3 className="font-bold">Backup dos dados</h3>
          <p className="text-xs text-slate-500">Exporta todos os lançamentos num arquivo .json, que você pode guardar no Drive ou mandar para você mesmo.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={exportBackup}>
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Importar
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readBackup(f)
            e.target.value = ''
          }}
        />
        {pending && (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p>
              O arquivo tem <b>{pending.transactions.length}</b> lançamento(s). Você tem {transactions.length} hoje.
            </p>
            <button className="btn-primary w-full" onClick={addToCurrent}>Adicionar aos atuais</button>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => setPending(null)}>Cancelar</button>
              <button className="btn bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" onClick={restore}>Substituir tudo</button>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">{transactions.length} lançamento(s) salvos.</p>
      </section>

      <section className="card space-y-2">
        <h3 className="flex items-center gap-2 font-bold">
          <Smartphone className="h-4 w-4" /> Instalar no celular
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <b>iPhone (Safari):</b> toque em Compartilhar → <i>Adicionar à Tela de Início</i>.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <b>Android (Chrome):</b> menu ⋮ → <i>Adicionar à tela inicial</i>.
        </p>
      </section>

      <section className="card space-y-2">
        <ConfirmButton
          className="w-full"
          confirmLabel="Toque de novo para apagar tudo"
          onConfirm={async () => {
            await replaceAll({ transactions: [] })
            setMsg('Todos os lançamentos foram apagados.')
          }}
        >
          <Trash2 className="h-4 w-4" /> Apagar todos os lançamentos
        </ConfirmButton>
        <p className="text-center text-xs text-slate-500">Não pode ser desfeito. Exporte um backup antes.</p>
      </section>
    </div>
  )
}
