import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn, money } from '../lib/utils'
import { LIMITE, MARCA } from './lib'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('titulo text-2xl font-extrabold', className)}>
      {MARCA.nome}
      <span className="text-[var(--verde)]">{MARCA.destaque}</span>
    </span>
  )
}

// ---------- Avisos (toasts) ----------
type Aviso = { id: number; texto: string; erro: boolean }
export function avisar(texto: string, erro = false) {
  window.dispatchEvent(new CustomEvent('aviso', { detail: { texto, erro } }))
}
/** Executa uma ação assíncrona mostrando o erro, se houver. Devolve true quando deu certo. */
export async function tentar(fn: () => Promise<unknown>, sucesso?: string) {
  try {
    await fn()
    if (sucesso) avisar(sucesso)
    return true
  } catch (e) {
    avisar(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Algo deu errado.', true)
    return false
  }
}
export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([])
  useEffect(() => {
    const on = (e: Event) => {
      const a = { id: Date.now() + Math.random(), ...(e as CustomEvent).detail } as Aviso
      setLista((l) => [...l, a])
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), a.erro ? 6000 : 3500)
    }
    window.addEventListener('aviso', on)
    return () => window.removeEventListener('aviso', on)
  }, [])
  return (
    <div className="nao-imprimir pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-8" role="status" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={cn('max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl', a.erro ? 'border-red-400/50 bg-[#2a1216] text-red-100' : 'border-[var(--verde)]/50 bg-[#0c2a1c] text-emerald-50')}>
          {a.texto}
        </div>
      ))}
    </div>
  )
}

// ---------- Blocos ----------
export function Modal({ titulo, onClose, children, largo }: { titulo: string; onClose: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={cn('cartao max-h-[92vh] w-full overflow-y-auto rounded-b-none sm:rounded-b-[1.125rem]', largo ? 'max-w-2xl' : 'max-w-lg')}
      >
        <div className="nao-imprimir sticky top-0 z-10 flex items-center justify-between border-b border-[var(--borda)] bg-[var(--painel)] px-5 py-3.5">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-[var(--tinta-2)] hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ rotulo, dica, children, className }: { rotulo: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block text-sm', className)}>
      <span className="mb-1.5 block font-medium text-[var(--tinta-2)]">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-[var(--tinta-3)]">{dica}</span>}
    </label>
  )
}

export function Botao({ ocupado, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ocupado?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || ocupado} className={cn('btn', className)}>
      {ocupado && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Tile({ rotulo, valor, detalhe, icone }: { rotulo: string; valor: string; detalhe?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="cartao p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--tinta-2)]">
        {rotulo}
        {icone && <span className="text-[var(--tinta-3)]">{icone}</span>}
      </div>
      <p className="num titulo mt-2 text-2xl font-bold sm:text-[1.7rem]">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-[var(--tinta-3)]">{detalhe}</p>}
    </div>
  )
}

export function Vazio({ icone, titulo, texto, children }: { icone: ReactNode; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="cartao flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--verde)]/10 text-[var(--verde)]">{icone}</span>
      <h3 className="mt-4 text-lg font-bold">{titulo}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--tinta-2)]">{texto}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}

export function Cabecalho({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-[var(--tinta-2)]">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Abas<T extends string>({ abas, atual, onChange }: { abas: [T, string][]; atual: T; onChange: (a: T) => void }) {
  return (
    <div role="tablist" className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--borda)] bg-[var(--painel)] p-1">
      {abas.map(([id, nome]) => (
        <button
          key={id}
          role="tab"
          aria-selected={atual === id}
          onClick={() => onChange(id)}
          className={cn('whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold', atual === id ? 'bg-[var(--verde)] text-[var(--verde-escuro)]' : 'text-[var(--tinta-2)] hover:bg-white/5')}
        >
          {nome}
        </button>
      ))}
    </div>
  )
}

// ---------- Gráficos ----------
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const curto = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(v)))

/** Entradas e saídas por mês do ano: barras agrupadas, um eixo, com dica ao passar o dedo/mouse. */
export function BarrasAno({ entradas, saidas, ano }: { entradas: number[]; saidas: number[]; ano: string }) {
  const [foco, setFoco] = useState<number | null>(null)
  const [tabela, setTabela] = useState(false)
  const W = 720
  const H = 240
  const esq = 46
  const base = H - 26
  const topo = 12
  const bruto = Math.max(...entradas, ...saidas, 1)
  const passo = Math.pow(10, Math.floor(Math.log10(bruto)))
  const max = Math.ceil(bruto / (passo / 2)) * (passo / 2)
  const y = (v: number) => base - (v / max) * (base - topo)
  const faixa = (W - esq) / 12
  const larg = Math.min(16, faixa / 2 - 5)
  const barra = (x: number, v: number, cor: string) => {
    if (v <= 0) return null
    const h = Math.max(2, base - y(v))
    const r = Math.min(4, h)
    return <path d={`M${x},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${larg - 2 * r} q${r},0 ${r},${r} v${h - r} z`} fill={cor} />
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-4 text-xs text-[var(--tinta-2)]">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm bg-[var(--entrada)]" /> Entradas
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm bg-[var(--saida)]" /> Saídas
          </span>
        </div>
        <button className="text-xs text-[var(--tinta-3)] underline-offset-2 hover:underline" onClick={() => setTabela(!tabela)}>
          {tabela ? 'Ver gráfico' : 'Ver em tabela'}
        </button>
      </div>
      {tabela ? (
        <table className="num w-full text-sm">
          <thead className="text-left text-xs text-[var(--tinta-3)]">
            <tr>
              <th className="py-1 font-medium">Mês</th>
              <th className="py-1 text-right font-medium">Entradas</th>
              <th className="py-1 text-right font-medium">Saídas</th>
            </tr>
          </thead>
          <tbody>
            {MESES.map((m, i) => (
              <tr key={m} className="border-t border-[var(--borda)]">
                <td className="py-1.5">
                  {m}/{ano.slice(2)}
                </td>
                <td className="py-1.5 text-right">{money(entradas[i])}</td>
                <td className="py-1.5 text-right">{money(saidas[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative" onMouseLeave={() => setFoco(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Entradas e saídas por mês em ${ano}`}>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={esq} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--borda)" strokeDasharray={f ? '3 4' : undefined} />
                <text x={esq - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="var(--tinta-3)">
                  {curto(max * f)}
                </text>
              </g>
            ))}
            {MESES.map((m, i) => {
              const cx = esq + faixa * i + faixa / 2
              return (
                <g key={m}>
                  {foco === i && <rect x={esq + faixa * i} y={topo} width={faixa} height={base - topo} fill="rgba(255,255,255,0.05)" rx="6" />}
                  {barra(cx - larg - 1, entradas[i], 'var(--entrada)')}
                  {barra(cx + 1, saidas[i], 'var(--saida)')}
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={foco === i ? 'var(--tinta)' : 'var(--tinta-3)'}>
                    {m}
                  </text>
                  <rect x={esq + faixa * i} y={0} width={faixa} height={H} fill="transparent" onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)} />
                </g>
              )
            })}
          </svg>
          {foco !== null && (
            <div
              className="num pointer-events-none absolute top-1 z-10 w-44 -translate-x-1/2 rounded-xl border border-[var(--borda)] bg-[#081622] p-3 text-xs shadow-xl"
              style={{ left: `${Math.min(86, Math.max(14, ((esq + faixa * foco + faixa / 2) / W) * 100))}%` }}
            >
              <p className="mb-1.5 font-semibold">
                {MESES[foco]}/{ano}
              </p>
              <p className="flex justify-between gap-2 text-[var(--tinta-2)]">
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-sm bg-[var(--entrada)]" />
                  Entradas
                </span>
                <b className="text-[var(--tinta)]">{money(entradas[foco])}</b>
              </p>
              <p className="mt-0.5 flex justify-between gap-2 text-[var(--tinta-2)]">
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-sm bg-[var(--saida)]" />
                  Saídas
                </span>
                <b className="text-[var(--tinta)]">{money(saidas[foco])}</b>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Quanto do limite anual de R$ 81 mil já foi usado. */
export function MedidorLimite({ total, projecao }: { total: number; projecao?: number }) {
  const pct = (total / LIMITE) * 100
  const tom = pct > 100 ? 'critico' : pct >= 80 ? 'alerta' : 'bom'
  const rotulo = pct > 100 ? 'Limite ultrapassado' : pct >= 80 ? 'Perto do limite' : 'Dentro do limite'
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="num titulo text-2xl font-bold">
          {money(total)} <span className="text-sm font-medium text-[var(--tinta-3)]">de {money(LIMITE)}</span>
        </p>
        <span className={`chip chip-${tom}`}>
          {rotulo} · {Math.round(pct)}%
        </span>
      </div>
      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={LIMITE} aria-valuenow={Math.round(total)} aria-label="Uso do limite anual do MEI">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `var(--${tom})` }} />
        <div className="absolute inset-y-0 w-0.5 bg-[var(--fundo)]" style={{ left: '80%' }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-[var(--tinta-3)]">
        <span>Disponível: {money(Math.max(0, LIMITE - total))}</span>
        {projecao !== undefined && projecao > 0 && <span>No ritmo atual, o ano fecha em {money(projecao)}</span>}
      </div>
    </div>
  )
}

/** Ranking de categorias: barras horizontais de uma cor só, com o valor ao lado. */
export function BarrasCategoria({ itens }: { itens: [string, number][] }) {
  const max = Math.max(...itens.map(([, v]) => v), 1)
  return (
    <ul className="space-y-3">
      {itens.map(([nome, v]) => (
        <li key={nome}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate text-[var(--tinta-2)]">{nome}</span>
            <span className="num shrink-0 font-medium">{money(v)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/5">
            <div className="h-full rounded-full bg-[var(--saida)]" style={{ width: `${Math.max(2, (v / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
