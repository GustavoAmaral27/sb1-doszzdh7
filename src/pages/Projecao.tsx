import { useEffect, useMemo, useState } from 'react'
import ProjectionChart from '../components/ProjectionChart'
import { useFiltered, useInitialBalance } from '../store'
import { project } from '../lib/projection'
import { LAST_MONTH } from '../lib/finance'
import { cn, monthLabel, money, parseMoney } from '../lib/utils'

const PREFS_KEY = 'financeiro:projecao'

function loadPrefs() {
  try {
    return { taxa: '0,90', pct: '100', ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') } as { taxa: string; pct: string }
  } catch {
    return { taxa: '0,90', pct: '100' }
  }
}

/** Número sem "R$" para caber na tabela (o R$ fica no cabeçalho). */
const num = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const pctFmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Projecao() {
  const list = useFiltered()
  const saldoInicial = useInitialBalance()
  const [prefs, setPrefs] = useState(loadPrefs)
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* armazenamento indisponível */
    }
  }, [prefs])

  const taxa = Math.max(0, parseMoney(prefs.taxa) || 0) / 100
  const pct = Math.min(100, Math.max(0, parseMoney(prefs.pct) || 0)) / 100
  const taxaAno = (Math.pow(1 + taxa, 12) - 1) * 100

  const meses = useMemo(() => project(list, saldoInicial, taxa, pct), [list, saldoInicial, taxa, pct])
  const fim = meses[meses.length - 1]
  const rendimentoTotal = meses.reduce((a, m) => a + m.rendimento, 0)
  const negativos = meses.filter((m) => m.comAplicacao < 0)

  const anos = useMemo(() => {
    const by = new Map<string, { resultado: number; rendimento: number; fim: number }>()
    for (const m of meses) {
      const y = m.month.slice(0, 4)
      const cur = by.get(y) ?? { resultado: 0, rendimento: 0, fim: 0 }
      by.set(y, { resultado: cur.resultado + m.resultado, rendimento: cur.rendimento + m.rendimento, fim: m.comAplicacao })
    }
    return [...by.entries()]
  }, [meses])

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-slate-900 p-5 text-white shadow-lg">
        <p className="text-sm text-blue-100">Disponível em {monthLabel(LAST_MONTH).toLowerCase()} aplicando</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{money(fim.comAplicacao)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-sm">
          <div>
            <p className="text-blue-100">Sem aplicar</p>
            <p className="font-semibold tabular-nums">{money(fim.semAplicacao)}</p>
          </div>
          <div>
            <p className="text-blue-100">Rendimento</p>
            <p className="font-semibold tabular-nums">+ {money(rendimentoTotal)}</p>
          </div>
        </div>
      </section>

      <section className="card grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="proj-taxa">Taxa ao mês (%)</label>
          <input id="proj-taxa" className="input" inputMode="decimal" value={prefs.taxa} onChange={(e) => setPrefs((p) => ({ ...p, taxa: e.target.value }))} />
          <p className="mt-1 text-xs text-slate-500">≈ {pctFmt(taxaAno)}% ao ano</p>
        </div>
        <div>
          <label className="label" htmlFor="proj-pct">Aplicar (%)</label>
          <input id="proj-pct" className="input" inputMode="decimal" value={prefs.pct} onChange={(e) => setPrefs((p) => ({ ...p, pct: e.target.value }))} />
          <p className="mt-1 text-xs text-slate-500">do resultado de cada mês</p>
        </div>
        <p className="col-span-2 text-xs text-slate-500">
          Começa com o saldo inicial de Ajustes ({money(saldoInicial)}) e soma o resultado previsto de cada mês (receitas − despesas
          pelo vencimento). Valores brutos, sem imposto de renda.
        </p>
      </section>

      {negativos.length > 0 && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          O disponível fica negativo em {negativos.length} mês(es), a partir de {monthLabel(negativos[0].month).toLowerCase()}.
        </p>
      )}

      <section className="card">
        <h3 className="mb-2 font-bold">Evolução do disponível</h3>
        <ProjectionChart data={meses} />
      </section>

      <section className="card">
        <h3 className="mb-2 font-bold">Por ano <span className="text-xs font-normal text-slate-500">(R$)</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-medium">Ano</th>
                <th className="pb-2 pl-2 text-right font-medium">Resultado</th>
                <th className="pb-2 pl-2 text-right font-medium">Rendim.</th>
                <th className="pb-2 pl-2 text-right font-medium">Disponível</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {anos.map(([ano, a]) => (
                <tr key={ano}>
                  <td className="py-2 font-semibold">{ano}</td>
                  <td className={cn('py-2 pl-2 text-right', a.resultado < 0 && 'text-red-700 dark:text-red-400')}>{num(a.resultado)}</td>
                  <td className="py-2 pl-2 text-right">{num(a.rendimento)}</td>
                  <td className={cn('py-2 pl-2 text-right font-semibold', a.fim < 0 && 'text-red-700 dark:text-red-400')}>{num(a.fim)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
