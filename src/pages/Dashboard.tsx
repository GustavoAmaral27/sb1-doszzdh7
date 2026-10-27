import { useMemo } from 'react'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import CloudAccount from '../components/CloudAccount'
import CompanyBadge from '../components/CompanyBadge'
import { useFiltered, useStore } from '../store'
import { COMPANIES, COMPANY_IDS } from '../types'
import { summarizeMonth } from '../lib/finance'
import { amountColor, cn, fmtDate, monthKey, monthLabel, money, statusOf, todayISO } from '../lib/utils'
import type { Tab } from '../App'

export default function Dashboard({ month, onNavigate }: { month: string; onNavigate: (t: Tab) => void }) {
  const { transactions, company, session } = useStore()
  const list = useFiltered()
  const today = todayISO()
  const s = useMemo(() => summarizeMonth(list, month, today), [list, month, today])

  const perCompany = useMemo(
    () => COMPANY_IDS.map((id) => ({ id, s: summarizeMonth(transactions.filter((t) => t.company === id), month, today) })),
    [transactions, month, today],
  )

  const lancamentos = useMemo(
    () =>
      list
        .filter((t) => monthKey(t.dueDate) === month)
        .sort((a, b) => Number(a.paid) - Number(b.paid) || a.dueDate.localeCompare(b.dueDate)),
    [list, month],
  )


  return (
    <div className="space-y-4">
      {/* Sem login, os lançamentos da nuvem não chegam: mostra a entrada logo no início. */}
      {!session && <CloudAccount />}

      <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-slate-900 p-5 text-white shadow-lg">
        <p className="text-sm text-blue-100">Resultado previsto do mês</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{money(s.previsto)}</p>
        <p className="text-xs text-blue-200">A receber − a pagar com vencimento em {monthLabel(month).toLowerCase()}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-sm">
          <div>
            <p className="text-blue-100">Realizado até agora</p>
            <p className="font-semibold tabular-nums">{money(s.realizado)}</p>
          </div>
          <div>
            <p className="text-blue-100">Falta acontecer</p>
            <p className="font-semibold tabular-nums">{money(s.previsto - s.realizado)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate('receber')} className="card text-left">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <ArrowDownCircle className="h-4 w-4" style={{ color: 'var(--entrada)' }} /> A receber
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(s.receber)}</p>
          <p className="text-xs text-slate-500">Recebido: {money(s.recebido)}</p>
          <p className="text-xs text-slate-500">Falta: {money(s.receber - s.recebido)}</p>
        </button>
        <button onClick={() => onNavigate('pagar')} className="card text-left">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <ArrowUpCircle className="h-4 w-4" style={{ color: 'var(--saida)' }} /> A pagar
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(s.pagar)}</p>
          <p className="text-xs text-slate-500">Pago: {money(s.pago)}</p>
          <p className="text-xs text-slate-500">Falta: {money(s.pagar - s.pago)}</p>
        </button>
      </div>

      {(s.qtdVencidoPagar > 0 || s.qtdVencidoReceber > 0) && (
        <section className="card ring-red-200 dark:ring-red-900">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> Vencidas neste mês
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <button className="text-left" onClick={() => onNavigate('pagar')}>
              <p className="text-slate-500">A pagar ({s.qtdVencidoPagar})</p>
              <p className="font-bold tabular-nums">{money(s.vencidoPagar)}</p>
            </button>
            <button className="text-left" onClick={() => onNavigate('receber')}>
              <p className="text-slate-500">A receber ({s.qtdVencidoReceber})</p>
              <p className="font-bold tabular-nums">{money(s.vencidoReceber)}</p>
            </button>
          </div>
        </section>
      )}

      {company === 'todas' && (
        <section className="card">
          <h3 className="mb-3 font-bold">Por empresa</h3>
          <div className="space-y-3">
            {perCompany.map(({ id, s: cs }) => (
              <div key={id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', COMPANIES[id].dot)} />
                  <p className="truncate text-sm font-semibold">{COMPANIES[id].name}</p>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">A receber</dt>
                    <dd className="font-bold tabular-nums">{money(cs.receber)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">A pagar</dt>
                    <dd className="font-bold tabular-nums">{money(cs.pagar)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Resultado</dt>
                    <dd className={cn('font-bold tabular-nums', cs.previsto < 0 && 'text-red-700 dark:text-red-400')}>{money(cs.previsto)}</dd>
                  </div>
                </dl>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-bold dark:border-slate-700">
              <span>Total do mês (soma)</span>
              <span className="tabular-nums">{money(s.previsto)}</span>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h3 className="mb-1 font-bold">Lançamentos de {monthLabel(month).split(' ')[0].toLowerCase()}</h3>
        {lancamentos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nenhum lançamento neste mês.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {lancamentos.map((t) => {
              const st = statusOf(t, today)
              return (
                <li key={t.id} className={cn('flex items-center justify-between gap-3 py-2.5', t.paid && 'opacity-60')}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.description}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={cn(st === 'vencido' && 'font-semibold text-red-700 dark:text-red-400')}>
                        {st === 'pago' ? (t.type === 'pagar' ? 'Pago' : 'Recebido') : st === 'vencido' ? 'Venceu' : 'Vence'} {fmtDate(t.dueDate)}
                      </span>
                      {company === 'todas' && <CompanyBadge id={t.company} />}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-sm font-bold tabular-nums', amountColor(t.type))}>
                      {t.type === 'pagar' ? '−' : '+'} {money(t.amount)}
                    </p>
                    <p className="text-[11px] text-slate-500">{t.type === 'pagar' ? 'A pagar' : 'A receber'}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
