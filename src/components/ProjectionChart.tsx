import { useState } from 'react'
import type { ProjectionMonth } from '../lib/projection'
import { monthLabel, money } from '../lib/utils'

/** Linhas do disponível acumulado: aplicando × sem aplicar. Toque para ver o mês. */
export default function ProjectionChart({ data }: { data: ProjectionMonth[] }) {
  const [idx, setIdx] = useState(data.length - 1)
  const W = 340
  const H = 180
  const pad = { top: 12, bottom: 22, left: 4, right: 4 }
  const vals = data.flatMap((d) => [d.comAplicacao, d.semAplicacao])
  const max = Math.max(1, ...vals)
  const min = Math.min(0, ...vals)
  const x = (i: number) => pad.left + (i / Math.max(1, data.length - 1)) * (W - pad.left - pad.right)
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * (H - pad.top - pad.bottom)
  const line = (k: 'comAplicacao' | 'semAplicacao') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
  const area = `${line('comAplicacao')} L${x(data.length - 1)},${y(min)} L${x(0)},${y(min)} Z`
  const sel = data[idx]
  const years = data.map((d, i) => ({ i, d })).filter(({ d }) => d.month.endsWith('-01'))

  function pick(clientX: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect()
    const rel = ((clientX - r.left) / r.width) * W
    const i = Math.round(((rel - pad.left) / (W - pad.left - pad.right)) * (data.length - 1))
    setIdx(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: 'var(--entrada)' }} /> Aplicando
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-slate-400" /> Sem aplicar
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Disponível acumulado aplicando e sem aplicar"
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerMove={(e) => e.buttons && pick(e.clientX, e.currentTarget)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={y(min + (max - min) * f)} y2={y(min + (max - min) * f)} className="stroke-slate-200 dark:stroke-slate-800" />
        ))}
        {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-slate-400 dark:stroke-slate-600" strokeDasharray="3 3" />}
        <path d={area} fill="var(--entrada)" opacity={0.1} />
        <path d={line('semAplicacao')} fill="none" className="stroke-slate-400" strokeWidth={2} strokeLinejoin="round" />
        <path d={line('comAplicacao')} fill="none" stroke="var(--entrada)" strokeWidth={2} strokeLinejoin="round" />
        <line x1={x(idx)} x2={x(idx)} y1={pad.top} y2={H - pad.bottom} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1} />
        <circle cx={x(idx)} cy={y(sel.semAplicacao)} r={4} className="fill-slate-400 stroke-white dark:stroke-slate-900" strokeWidth={2} />
        <circle cx={x(idx)} cy={y(sel.comAplicacao)} r={4.5} fill="var(--entrada)" className="stroke-white dark:stroke-slate-900" strokeWidth={2} />
        {years.map(({ i, d }) => (
          <text key={d.month} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">
            {d.month.slice(0, 4)}
          </text>
        ))}
      </svg>
      <div className="mt-1 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
        <span className="font-semibold">{monthLabel(sel.month, true)}</span>
        <span className="tabular-nums">Aplicando: <b>{money(sel.comAplicacao)}</b></span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">Sem: {money(sel.semAplicacao)}</span>
      </div>
    </div>
  )
}
