import { useRef, useState } from 'react'
import { Download, Smartphone, Trash2, Upload } from 'lucide-react'
import { useStore } from '../store'
import { COMPANIES, COMPANY_IDS, type CompanyId, type Settings, type Transaction } from '../types'
import { money, parseMoney, todayISO } from '../lib/utils'

export default function Ajustes() {
  const { settings, setSettings, transactions, replaceAll } = useStore()
  const [balances, setBalances] = useState<Record<CompanyId, string>>(() => ({
    ztec: settings.initialBalance.ztec.toFixed(2).replace('.', ','),
    amaral: settings.initialBalance.amaral.toFixed(2).replace('.', ','),
  }))
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function saveBalances() {
    const initialBalance = { ...settings.initialBalance }
    for (const id of COMPANY_IDS) initialBalance[id] = parseMoney(balances[id]) || 0
    setSettings({ ...settings, initialBalance })
    setMsg('Saldos iniciais salvos.')
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), transactions, settings }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financeiro-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { transactions?: Transaction[]; settings?: Settings }
      if (!Array.isArray(data.transactions)) throw new Error()
      if (!confirm(`Restaurar ${data.transactions.length} lançamento(s)? Os dados atuais serão substituídos.`)) return
      replaceAll({ transactions: data.transactions, settings: data.settings })
      if (data.settings) {
        setBalances({
          ztec: data.settings.initialBalance.ztec.toFixed(2).replace('.', ','),
          amaral: data.settings.initialBalance.amaral.toFixed(2).replace('.', ','),
        })
      }
      setMsg('Backup restaurado com sucesso.')
    } catch {
      setMsg('Arquivo de backup inválido.')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Ajustes</h2>
      {msg && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">{msg}</p>}

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
          <p className="text-xs text-slate-500">
            Os dados ficam salvos neste aparelho. Faça backup com frequência (ex.: salve no Google Drive ou envie por WhatsApp para você) para não perder nada se trocar de celular ou limpar o navegador.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={exportBackup}>
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Restaurar
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importBackup(f)
            e.target.value = ''
          }}
        />
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
          <b>Android (Chrome):</b> menu ⋮ → <i>Instalar app</i> ou <i>Adicionar à tela inicial</i>.
        </p>
      </section>

      <section className="card">
        <button
          className="btn w-full bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          onClick={() => {
            if (confirm('Apagar TODOS os lançamentos? Faça um backup antes. Essa ação não pode ser desfeita.')) {
              replaceAll({ transactions: [] })
              setMsg('Todos os lançamentos foram apagados.')
            }
          }}
        >
          <Trash2 className="h-4 w-4" /> Apagar todos os lançamentos
        </button>
      </section>
    </div>
  )
}
