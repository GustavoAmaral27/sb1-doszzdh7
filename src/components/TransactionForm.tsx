import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import Sheet from './Sheet'
import ConfirmButton from './ConfirmButton'
import { useStore } from '../store'
import { CATEGORIES, COMPANIES, COMPANY_IDS, type CompanyId, type Transaction, type TxType } from '../types'
import { monthsUntilLast } from '../lib/finance'
import { addMonths, cn, parseMoney, todayISO, uid } from '../lib/utils'

interface Props {
  type: TxType
  editing?: Transaction
  onClose: () => void
}

export default function TransactionForm({ type, editing, onClose }: Props) {
  const { company, addMany, update, remove } = useStore()
  const isPagar = type === 'pagar'

  const [form, setForm] = useState({
    company: (editing?.company ?? (company === 'todas' ? 'ztec' : company)) as CompanyId,
    description: editing?.description ?? '',
    party: editing?.party ?? '',
    category: editing?.category ?? CATEGORIES[type][0],
    amount: editing ? editing.amount.toFixed(2).replace('.', ',') : '',
    dueDate: editing?.dueDate ?? todayISO(),
    paid: editing?.paid ?? false,
    paidDate: editing?.paidDate ?? todayISO(),
    notes: editing?.notes ?? '',
    repeat: 1,
    fixo: false,
  })
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseMoney(form.amount)
    if (!form.description.trim()) return setError('Informe a descrição.')
    if (!amount || amount <= 0 || Number.isNaN(amount)) return setError('Informe um valor válido.')
    if (!form.dueDate) return setError('Informe o vencimento.')

    const base = {
      company: form.company,
      type,
      description: form.description.trim(),
      party: form.party.trim(),
      category: form.category,
      amount: Math.round(amount * 100) / 100,
      notes: form.notes.trim() || undefined,
    }

    if (editing) {
      update({
        ...editing,
        ...base,
        dueDate: form.dueDate,
        paid: form.paid,
        paidDate: form.paid ? form.paidDate || form.dueDate : undefined,
      })
    } else {
      // Mensal fixo: um lançamento por mês até o fim da projeção; senão, parcelas (1/n, 2/n…).
      const n = form.fixo ? monthsUntilLast(form.dueDate) : Math.max(1, Math.min(60, Number(form.repeat) || 1))
      const parcelas = !form.fixo && n > 1
      const now = new Date().toISOString()
      addMany(
        Array.from({ length: n }, (_, i) => ({
          ...base,
          id: uid(),
          description: parcelas ? `${base.description} (${i + 1}/${n})` : base.description,
          dueDate: addMonths(form.dueDate, i),
          // só a primeira parcela pode já nascer paga
          paid: i === 0 && form.paid,
          paidDate: i === 0 && form.paid ? form.paidDate || form.dueDate : undefined,
          createdAt: now,
        })),
      )
    }
    onClose()
  }

  const title = `${editing ? 'Editar' : 'Nova'} conta a ${isPagar ? 'pagar' : 'receber'}`

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Empresa</span>
          <div className="grid grid-cols-2 gap-2">
            {COMPANY_IDS.map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => set('company', id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold',
                  form.company === id
                    ? 'border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                    : 'border-slate-300 dark:border-slate-700',
                )}
              >
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', COMPANIES[id].dot)} />
                <span className="leading-tight">{COMPANIES[id].name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="desc">Descrição</label>
          <input id="desc" className="input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={isPagar ? 'Ex.: Aluguel do escritório' : 'Ex.: Honorários outubro'} />
        </div>

        <div>
          <label className="label" htmlFor="party">{isPagar ? 'Fornecedor' : 'Cliente'}</label>
          <input id="party" className="input" value={form.party} onChange={(e) => set('party', e.target.value)} placeholder="Opcional" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="amount">Valor (R$)</label>
            <input id="amount" className="input" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <label className="label" htmlFor="due">Vencimento</label>
            <input id="due" type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cat">Categoria</label>
          <select id="cat" className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {[...new Set([...CATEGORIES[type], form.category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {!editing && (
          <div className="space-y-2">
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={form.fixo} onChange={(e) => set('fixo', e.target.checked)} />
              <span className="text-sm font-medium">Mensal fixo: repete todo mês até dez/2028</span>
            </label>
            {!form.fixo && (
              <div>
                <label className="label" htmlFor="repeat">Parcelas</label>
                <input id="repeat" type="number" min={1} max={60} className="input" value={form.repeat} onChange={(e) => set('repeat', Number(e.target.value))} />
                <p className="mt-1 text-xs text-slate-500">1 = lançamento único. Ex.: 5 cria 5 parcelas mensais (1/5 a 5/5).</p>
              </div>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <input type="checkbox" className="h-5 w-5 accent-green-600" checked={form.paid} onChange={(e) => set('paid', e.target.checked)} />
          <span className="text-sm font-medium">{isPagar ? 'Já foi pago' : 'Já foi recebido'}</span>
        </label>
        {form.paid && (
          <div>
            <label className="label" htmlFor="paidDate">Data do {isPagar ? 'pagamento' : 'recebimento'}</label>
            <input id="paidDate" type="date" className="input" value={form.paidDate} onChange={(e) => set('paidDate', e.target.value)} />
          </div>
        )}

        <div>
          <label className="label" htmlFor="notes">Observações</label>
          <textarea id="notes" rows={2} className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

        <div className="flex gap-2 pt-1">
          {editing && (
            <ConfirmButton
              confirmLabel="Confirmar exclusão"
              onConfirm={() => {
                remove(editing.id)
                onClose()
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </ConfirmButton>
          )}
          <button type="submit" className="btn-primary flex-1">Salvar</button>
        </div>
      </form>
    </Sheet>
  )
}
