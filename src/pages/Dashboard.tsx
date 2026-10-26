import { useMemo } from 'react'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, ChevronRight, Wallet } from 'lucide-react'
import CloudAccount from '../components/CloudAccount'
import CompanyBadge from '../components/CompanyBadge'
import { useFiltered, useInitialBalance, useStore } from '../store'
import { COMPANIES, COMPANY_IDS } from '../types'
import { summarize } from '../lib/finance'
import { cn, fmtDate, monthKey, monthLabel, money, statusOf, todayISO } from '../lib/utils'
import type { Tab } from '../App'

export default function Dashboard({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const { transactions, settings, company, session } = useStore()
  const list = useFiltered()
  const initial = useInitialBalance()
  const today = todayISO()
  const s = useMemo(() => summarize(list, initial, today), [list, initial, today])

  const perCompany = useMemo(
    () =>
      COMPANY_IDS.map((id) => ({
        id,
        s: summarize(
          transactions.filter((t) => t.company === id),
          settings.initialBalance[id],
          today,
        ),
      })),
    [transactions, settings, today],
  )

  const upcoming = useMemo(
    () =>
      list
        .filter((t) => !t.paid)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 8),
    [list],
  )

  const title = company === 'todas' ? 'Consolidado das duas empresas' : COMPANIES[company].name

  return (
    <div className="space-y-4">
      {/* Sem login, os lançamentos da nuvem não chegam: mostra a entrada logo no início. */}
      {!session && <CloudAccount />}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Visão geral</p>
        <h2 className="text-xl font-bold leading-tight">{title}</h2>
      </div>

      <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-slate-900 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-sm text-blue-100">
          <Wallet className="h-4 w-4" /> Saldo em caixa
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">{money(s.caixa)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-sm">
          <div>
            <p className="text-blue-100">Saldo previsto</p>
            <p className="font-semibold tabular-nums">{money(s.previsto)}</p>
          </div>
          <div>
            <p className="text-blue-100">Resultado do mês</p>
            <p className="font-semibold tabular-nums">{money(s.recebidoMes - s.pagoMes)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate('receber')} className="card text-left">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <ArrowDownCircle className="h-4 w-4" style={{ color: 'var(--entrada)' }} /> A receber
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(s.aReceber)}</p>
          <p className="text-xs text-slate-500">Recebido no mês: {money(s.recebidoMes)}</p>
        </button>
        <button onClick={() => onNavigate('pagar')} className="card text-left">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <ArrowUpCircle className="h-4 w-4" style={{ color: 'var(--saida)' }} /> A pagar
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(s.aPagar)}</p>
          <p className="text-xs text-slate-500">Pago no mês: {money(s.pagoMes)}</p>
        </button>
      </div>

      {(s.qtdVencidoPagar > 0 || s.qtdVencidoReceber > 0) && (
        <section className="card ring-red-200 dark:ring-red-900">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> Contas vencidas
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', COMPANIES[id].dot)} />
                    <p className="truncate text-sm font-semibold">{COMPANIES[id].name}</p>
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Caixa</dt>
                    <dd className="font-bold tabular-nums">{money(cs.caixa)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">A receber</dt>
                    <dd className="font-bold tabular-nums">{money(cs.aReceber)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">A pagar</dt>
                    <dd className="font-bold tabular-nums">{money(cs.aPagar)}</dd>
                  </div>
                </dl>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-bold dark:border-slate-700">
              <span>Total (soma)</span>
              <span className="tabular-nums">{money(s.caixa)}</span>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-bold">Próximos vencimentos</h3>
          <button className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400" onClick={() => onNavigate('fluxo')}>
            Fluxo de {monthLabel(monthKey(today)).split(' ')[0].toLowerCase()} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nenhuma conta em aberto. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {upcoming.map((t) => {
              const vencido = statusOf(t, today) === 'vencido'
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.description}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={cn(vencido && 'font-semibold text-red-700 dark:text-red-400')}>
                        {vencido ? 'Venceu' : 'Vence'} {fmtDate(t.dueDate)}
                      </span>
                      {company === 'todas' && <CompanyBadge id={t.company} />}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">
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
