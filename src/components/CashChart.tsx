import { useState } from 'react'
import { monthLabel, money } from '../lib/utils'

export interface MonthPoint {
  month: string
  entradas: number
  saidas: number
}

/** Barras agrupadas: entradas x saídas por mês. Toque/passe o mouse para ver os valores. */
export default function CashChart({ data, selected, onSelect }: { data: MonthPoint[]; selected: string; onSelect: (m: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const W = 340
  const H = 170
  const pad = { top: 12, bottom: 24, left: 4, right: 4 }
  const innerH = H - pad.top - pad.bottom
  const max = Math.max(1, ...data.flatMap((d) => [d.entradas, d.saidas]))
  const slot = (W - pad.left - pad.right) / data.length
  const barW = Math.min(18, slot / 3.2)
  const y = (v: number) => pad.top + innerH - (v / max) * innerH
  const active = data.find((d) => d.month === (hover ?? selected))

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--entrada)' }} /> Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--saida)' }} /> Saídas
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Entradas e saídas dos últimos meses">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} />
        ))}
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth={1} />
        {data.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2
          const isSel = d.month === selected
          return (
            <g
              key={d.month}
              onMouseEnter={() => setHover(d.month)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(d.month)}
              className="cursor-pointer"
              opacity={hover && hover !== d.month ? 0.55 : 1}
            >
              <rect x={cx - slot / 2} y={0} width={slot} height={H} fill={isSel ? 'currentColor' : 'transparent'} className="text-slate-100 dark:text-slate-800/60" />
              <Bar x={cx - barW - 1} w={barW} top={y(d.entradas)} bottom={y(0)} fill="var(--entrada)" />
              <Bar x={cx + 1} w={barW} top={y(d.saidas)} bottom={y(0)} fill="var(--saida)" />
              <text x={cx} y={H - 7} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400" fontWeight={isSel ? 700 : 400}>
                {monthLabel(d.month, true)}
              </text>
            </g>
          )
        })}
      </svg>
      {active && (
        <div className="mt-1 flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
          <span className="font-semibold">{monthLabel(active.month)}</span>
          <span className="tabular-nums text-slate-600 dark:text-slate-300">
            Entradas {money(active.entradas)} · Saídas {money(active.saidas)}
          </span>
        </div>
      )}
    </div>
  )
}

function Bar({ x, w, top, bottom, fill }: { x: number; w: number; top: number; bottom: number; fill: string }) {
  const h = bottom - top
  if (h <= 0) return null
  const r = Math.min(4, h, w / 2)
  // cantos arredondados só no topo, base reta na linha zero
  const d = `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${bottom} Z`
  return <path d={d} fill={fill} />
}
