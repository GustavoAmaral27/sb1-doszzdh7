import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CashChart from '../components/CashChart'
import CompanyBadge from '../components/CompanyBadge'
import { useFiltered, useInitialBalance, useStore } from '../store'
import { cashDate, signed } from '../lib/finance'
import { cn, fmtDate, monthKey, monthLabel, money, shiftMonth, todayISO } from '../lib/utils'
import type { Transaction } from '../types'

type Mode = 'realizado' | 'previsto'

export default function FluxoCaixa() {
  const { company } = useStore()
  const all = useFiltered()
  const initial = useInitialBalance()
  const [month, setMonth] = useState(monthKey(todayISO()))
  const [mode, setMode] = useState<Mode>('previsto')

  const included = useMemo(() => (mode === 'realizado' ? all.filter((t) => t.paid) : all), [all, mode])

  const { opening, entradas, saidas, days } = useMemo(() => {
    const start = `${month}-01`
    const opening = initial + included.filter((t) => cashDate(t) < start).reduce((a, t) => a + signed(t), 0)
    const inMonth = included.filter((t) => monthKey(cashDate(t)) === month).sort((a, b) => cashDate(a).localeCompare(cashDate(b)))
    const byDay = new Map<string, Transaction[]>()
    for (const t of inMonth) byDay.set(cashDate(t), [...(byDay.get(cashDate(t)) ?? []), t])
    let running = opening
    const days = [...byDay.entries()].map(([date, items]) => {
      const net = items.reduce((a, t) => a + signed(t), 0)
      running += net
      return { date, items, net, balance: running }
    })
    return {
      opening,
      entradas: inMonth.filter((t) => t.type === 'receber').reduce((a, t) => a + t.amount, 0),
      saidas: inMonth.filter((t) => t.type === 'pagar').reduce((a, t) => a + t.amount, 0),
      days,
    }
  }, [included, month, initial])

  const chart = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const m = shiftMonth(month, i - 4)
        const items = included.filter((t) => monthKey(cashDate(t)) === m)
        return {
          month: m,
          entradas: items.filter((t) => t.type === 'receber').reduce((a, t) => a + t.amount, 0),
          saidas: items.filter((t) => t.type === 'pagar').reduce((a, t) => a + t.amount, 0),
        }
      }),
    [included, month],
  )

  const closing = opening + entradas - saidas

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
        {(['previsto', 'realizado'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn('rounded-lg py-2 text-sm font-semibold', mode === m ? 'bg-white shadow dark:bg-slate-950' : 'text-slate-600 dark:text-slate-400')}
          >
            {m === 'previsto' ? 'Previsto' : 'Realizado'}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        {mode === 'previsto'
          ? 'Inclui contas em aberto pela data de vencimento e as já baixadas pela data de pagamento.'
          : 'Somente o que já foi efetivamente pago ou recebido.'}
      </p>

      <div className="card flex items-center justify-between p-2">
        <button className="rounded-lg p-2" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-bold">{monthLabel(month)}</span>
        <button className="rounded-lg p-2" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="card">
        <dl className="space-y-2 text-sm">
          <Row label="Saldo inicial do mês" value={opening} />
          <Row label="(+) Entradas" value={entradas} swatch="var(--entrada)" />
          <Row label="(−) Saídas" value={saidas} swatch="var(--saida)" />
          <div className="border-t border-slate-200 pt-2 dark:border-slate-700">
            <Row label="Saldo final do mês" value={closing} bold />
          </div>
        </dl>
      </div>

      <div className="card">
        <h3 className="mb-2 font-bold">Últimos meses</h3>
        <CashChart data={chart} selected={month} onSelect={setMonth} />
      </div>

      <div className="card">
        <h3 className="mb-1 font-bold">Movimentação diária</h3>
        {days.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Sem movimentação neste mês.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {days.map((d) => (
              <li key={d.date} className="py-3">
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{fmtDate(d.date)}</span>
                  <span className="text-slate-500">
                    Saldo: <b className={cn('tabular-nums', d.balance < 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-100')}>{money(d.balance)}</b>
                  </span>
                </div>
                <ul className="space-y-1">
                  {d.items.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: t.type === 'receber' ? 'var(--entrada)' : 'var(--saida)' }} />
                        <span className="truncate">{t.description}</span>
                        {company === 'todas' && <CompanyBadge id={t.company} />}
                        {!t.paid && <span className="shrink-0 text-[11px] text-slate-500">(previsto)</span>}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {t.type === 'pagar' ? '−' : '+'} {money(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold, swatch }: { label: string; value: number; bold?: boolean; swatch?: string }) {
  return (
    <div className={cn('flex justify-between', bold && 'text-base font-bold')}>
      <dt className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        {swatch && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />}
        {label}
      </dt>
      <dd className={cn('tabular-nums font-semibold', value < 0 && 'text-red-700 dark:text-red-400')}>{money(value)}</dd>
    </div>
  )
}
