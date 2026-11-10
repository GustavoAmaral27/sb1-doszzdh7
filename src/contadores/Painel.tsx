import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { cn, money, monthLabel, parseMoney, shiftMonth, todayISO } from '../lib/utils'
import { Logo } from './Landing'
import { ATIVIDADES, LIMITE_ANUAL, dadosExemplo, faturamentoAno, novoMei, useDados, valorDas, type Atividade, type Dados, type Mei } from './store'

type Aba = 'geral' | 'mes' | 'clientes' | 'ajustes'
const ABAS: [Aba, string][] = [
  ['geral', 'Visão geral'],
  ['mes', 'Mês'],
  ['clientes', 'Clientes'],
  ['ajustes', 'Ajustes'],
]

type Set = (fn: (d: Dados) => Dados) => void

export default function Painel() {
  const [dados, setDados] = useDados()
  const [aba, setAba] = useState<Aba>('geral')
  const [mes, setMes] = useState(todayISO().slice(0, 7))
  const ativos = dados.meis.filter((m) => m.ativo)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <a href="#/" aria-label="Página inicial">
          <Logo />
        </a>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--borda)] px-1 py-1 text-sm">
          <button aria-label="Mês anterior" className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setMes(shiftMonth(mes, -1))}>
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[9rem] text-center font-medium">{monthLabel(mes)}</span>
          <button aria-label="Próximo mês" className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setMes(shiftMonth(mes, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[var(--borda)] p-1">
        {ABAS.map(([id, nome]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium',
              aba === id ? 'bg-[var(--verde)] text-[#04130b]' : 'text-slate-300 hover:bg-white/5',
            )}
          >
            {nome}
          </button>
        ))}
      </nav>

      {dados.meis.length === 0 && aba !== 'ajustes' && aba !== 'clientes' ? (
        <div className="cartao p-8 text-center">
          <h2 className="text-xl font-semibold">Sua carteira está vazia</h2>
          <p className="mt-2 text-slate-300">Cadastre o primeiro MEI ou carregue uma carteira de exemplo para conhecer o painel.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn-verde px-5 py-3" onClick={() => setAba('clientes')}>
              Cadastrar MEI
            </button>
            <button className="btn-contorno px-5 py-3" onClick={() => setDados(dadosExemplo(todayISO().slice(0, 7)))}>
              Ver com dados de exemplo
            </button>
          </div>
        </div>
      ) : aba === 'geral' ? (
        <Geral dados={dados} ativos={ativos} mes={mes} />
      ) : aba === 'mes' ? (
        <Mes dados={dados} ativos={ativos} mes={mes} set={setDados} />
      ) : aba === 'clientes' ? (
        <Clientes dados={dados} mes={mes} set={setDados} />
      ) : (
        <Ajustes dados={dados} set={setDados} />
      )}
    </div>
  )
}

function Tile({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-[var(--borda)] bg-[#0f2233] p-4">
      <p className="text-sm text-slate-300">{rotulo}</p>
      <p className="mt-2 text-2xl font-bold">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-400">{detalhe}</p>}
    </div>
  )
}

function Geral({ dados, ativos, mes }: { dados: Dados; ativos: Mei[]; mes: string }) {
  const ano = mes.slice(0, 4)
  const anoDasn = String(Number(ano) - 1)
  const mrr = ativos.reduce((s, m) => s + m.mensalidade, 0)
  const recebido = ativos.reduce((s, m) => s + (dados.mensRecebida[`${m.id}:${mes}`] ? m.mensalidade : 0), 0)
  const dasPend = ativos.filter((m) => !dados.dasPago[`${m.id}:${mes}`])
  const mensPend = ativos.filter((m) => m.mensalidade > 0 && !dados.mensRecebida[`${m.id}:${mes}`])
  const dasnPend = ativos.filter((m) => !dados.dasnEntregue[`${m.id}:${anoDasn}`])
  const limite = ativos
    .map((m) => ({ m, total: faturamentoAno(dados, m.id, ano) }))
    .filter((x) => x.total >= LIMITE_ANUAL * 0.8)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      <section className="cartao p-5 sm:p-6">
        <p className="rotulo">Painel do contador</p>
        <h1 className="mt-2 text-2xl">Visão geral</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile rotulo="Receita recorrente" valor={money(mrr)} detalhe={`${money(mrr * 12)} por ano`} />
          <Tile rotulo="Recebido no mês" valor={money(recebido)} detalhe={`${money(mrr - recebido)} a receber`} />
          <Tile rotulo="MEIs ativos" valor={String(ativos.length)} detalhe={`${dados.meis.length - ativos.length} inativos`} />
          <Tile rotulo="DAS pendentes no mês" valor={String(dasPend.length)} detalhe={`de ${ativos.length} guias`} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Lista titulo="Perto do limite de faturamento" vazio={`Ninguém acima de 80% do limite em ${ano}.`}>
          {limite.map(({ m, total }) => (
            <li key={m.id} className="py-3">
              <div className="flex justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  {total > LIMITE_ANUAL && <AlertTriangle size={16} className="text-red-400" />}
                  {m.nome}
                </span>
                <span className={cn('font-semibold', total > LIMITE_ANUAL ? 'text-red-400' : 'text-amber-300')}>
                  {money(total)} · {Math.round((total / LIMITE_ANUAL) * 100)}%
                </span>
              </div>
              <Barra valor={total} />
            </li>
          ))}
        </Lista>
        <Lista titulo={`Mensalidades em aberto · ${monthLabel(mes)}`} vazio="Todas as mensalidades do mês foram recebidas.">
          {mensPend.map((m) => (
            <Linha key={m.id} nome={m.nome} valor={money(m.mensalidade)} />
          ))}
        </Lista>
        <Lista titulo={`DAS em aberto · ${monthLabel(mes)}`} vazio="Todos os DAS do mês estão pagos.">
          {dasPend.map((m) => (
            <Linha key={m.id} nome={m.nome} valor={money(valorDas(dados.salarioMinimo, m.atividade))} />
          ))}
        </Lista>
        <Lista titulo={`DASN ${anoDasn} a entregar`} vazio={`Todas as declarações de ${anoDasn} foram entregues.`}>
          {dasnPend.map((m) => (
            <Linha key={m.id} nome={m.nome} valor={`prazo 31/05/${ano}`} />
          ))}
        </Lista>
      </div>
    </div>
  )
}

function Lista({ titulo, vazio, children }: { titulo: string; vazio: string; children: ReactNode[] }) {
  return (
    <section className="cartao p-5">
      <h2 className="flex items-center justify-between font-semibold">
        {titulo}
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{children.length}</span>
      </h2>
      {children.length ? <ul className="mt-2 divide-y divide-[var(--borda)]">{children}</ul> : <p className="mt-3 text-sm text-slate-400">{vazio}</p>}
    </section>
  )
}

const Linha = ({ nome, valor }: { nome: string; valor: string }) => (
  <li className="flex justify-between gap-3 py-2.5 text-sm">
    <span>{nome}</span>
    <span className="shrink-0 text-slate-300">{valor}</span>
  </li>
)

function Barra({ valor }: { valor: number }) {
  const pct = Math.min(100, (valor / LIMITE_ANUAL) * 100)
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={cn('h-full rounded-full', valor > LIMITE_ANUAL ? 'bg-red-400' : pct >= 80 ? 'bg-amber-300' : 'bg-[var(--verde)]')} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Marcar({ ativo, rotulo, onClick }: { ativo: boolean; rotulo: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium',
        ativo ? 'border-[var(--verde)] bg-[var(--verde)]/15 text-[var(--verde)]' : 'border-[var(--borda)] text-slate-300 hover:bg-white/5',
      )}
    >
      {ativo && <Check size={15} />}
      {rotulo}
    </button>
  )
}

const alternar = (mapa: Record<string, boolean>, k: string) => {
  const novo = { ...mapa }
  if (novo[k]) delete novo[k]
  else novo[k] = true
  return novo
}

function Mes({ dados, ativos, mes, set }: { dados: Dados; ativos: Mei[]; mes: string; set: Set }) {
  const ano = mes.slice(0, 4)
  return (
    <div className="space-y-3">
      {ativos.length === 0 && <p className="cartao p-5 text-slate-300">Nenhum MEI ativo.</p>}
      {ativos.map((m) => {
        const k = `${m.id}:${mes}`
        const das = valorDas(dados.salarioMinimo, m.atividade)
        const total = faturamentoAno(dados, m.id, ano)
        const pendencias = [!dados.dasPago[k] && `o DAS de ${monthLabel(mes)} (${money(das)})`, m.mensalidade > 0 && !dados.mensRecebida[k] && `a mensalidade (${money(m.mensalidade)})`].filter(Boolean)
        const fone = m.telefone.replace(/\D/g, '')
        const texto = `Olá! Passando para lembrar que está em aberto ${pendencias.join(' e ')}.`
        return (
          <section key={m.id} className="cartao p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{m.nome}</h2>
                <p className="text-xs text-slate-400">
                  {ATIVIDADES[m.atividade]} · DAS {money(das)} · vence dia 20
                </p>
              </div>
              {fone && pendencias.length > 0 && (
                <a
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--borda)] px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  href={`https://wa.me/${fone.length <= 11 ? '55' + fone : fone}?text=${encodeURIComponent(texto)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={15} /> Lembrar
                </a>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Marcar ativo={!!dados.dasPago[k]} rotulo="DAS pago" onClick={() => set((d) => ({ ...d, dasPago: alternar(d.dasPago, k) }))} />
              {m.mensalidade > 0 && (
                <Marcar
                  ativo={!!dados.mensRecebida[k]}
                  rotulo={`Mensalidade ${money(m.mensalidade)}`}
                  onClick={() => set((d) => ({ ...d, mensRecebida: alternar(d.mensRecebida, k) }))}
                />
              )}
              <label className="ml-auto flex items-center gap-2 text-sm text-slate-300">
                Faturamento
                <input
                  key={k}
                  className="campo w-32 text-right"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={dados.faturamento[k] ? dados.faturamento[k].toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                  onBlur={(e) => {
                    const v = parseMoney(e.target.value)
                    set((d) => {
                      const faturamento = { ...d.faturamento }
                      if (v > 0) faturamento[k] = v
                      else delete faturamento[k]
                      return { ...d, faturamento }
                    })
                  }}
                />
              </label>
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-400">
              <span>Acumulado em {ano}</span>
              <span>
                {money(total)} de {money(LIMITE_ANUAL)}
              </span>
            </div>
            <Barra valor={total} />
          </section>
        )
      })}
    </div>
  )
}

function Clientes({ dados, mes, set }: { dados: Dados; mes: string; set: Set }) {
  const [editando, setEditando] = useState<Mei | null>(null)
  const anoDasn = String(Number(mes.slice(0, 4)) - 1)
  const existe = editando && dados.meis.some((m) => m.id === editando.id)

  const salvar = (m: Mei) => {
    set((d) => ({ ...d, meis: d.meis.some((x) => x.id === m.id) ? d.meis.map((x) => (x.id === m.id ? m : x)) : [...d.meis, m] }))
    setEditando(null)
  }
  const excluir = (m: Mei) => {
    if (!window.confirm(`Excluir ${m.nome} e todo o histórico dele?`)) return
    const limpar = <T,>(mapa: Record<string, T>) => Object.fromEntries(Object.entries(mapa).filter(([k]) => !k.startsWith(m.id + ':')))
    set((d) => ({
      ...d,
      meis: d.meis.filter((x) => x.id !== m.id),
      dasPago: limpar(d.dasPago),
      mensRecebida: limpar(d.mensRecebida),
      faturamento: limpar(d.faturamento),
      dasnEntregue: limpar(d.dasnEntregue),
    }))
    setEditando(null)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes ({dados.meis.length})</h1>
        <button className="btn-verde inline-flex items-center gap-2 px-4 py-2.5 text-sm" onClick={() => setEditando(novoMei())}>
          <Plus size={16} /> Novo MEI
        </button>
      </div>
      <div className="space-y-3">
        {dados.meis.length === 0 && <p className="cartao p-5 text-slate-300">Nenhum cliente cadastrado ainda.</p>}
        {dados.meis.map((m) => {
          const k = `${m.id}:${anoDasn}`
          return (
            <section key={m.id} className={cn('cartao flex flex-wrap items-center gap-3 p-4', !m.ativo && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">
                  {m.nome} {!m.ativo && <span className="text-xs font-normal text-slate-400">(inativo)</span>}
                </h2>
                <p className="text-xs text-slate-400">
                  {[m.cnpj, ATIVIDADES[m.atividade], `${money(m.mensalidade)}/mês`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Marcar ativo={!!dados.dasnEntregue[k]} rotulo={`DASN ${anoDasn}`} onClick={() => set((d) => ({ ...d, dasnEntregue: alternar(d.dasnEntregue, k) }))} />
              <button aria-label={`Editar ${m.nome}`} className="rounded-lg border border-[var(--borda)] p-2 hover:bg-white/5" onClick={() => setEditando(m)}>
                <Pencil size={16} />
              </button>
            </section>
          )
        })}
      </div>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setEditando(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label={existe ? 'Editar MEI' : 'Novo MEI'}
            className="cartao max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              salvar({ ...editando, nome: editando.nome.trim() })
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{existe ? 'Editar MEI' : 'Novo MEI'}</h2>
              <button type="button" aria-label="Fechar" className="rounded-full p-1.5 hover:bg-white/10" onClick={() => setEditando(null)}>
                <X size={18} />
              </button>
            </div>
            <Campo rotulo="Nome / razão social">
              <input className="campo" required autoFocus value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="CNPJ">
                <input className="campo" inputMode="numeric" value={editando.cnpj} onChange={(e) => setEditando({ ...editando, cnpj: e.target.value })} />
              </Campo>
              <Campo rotulo="WhatsApp (com DDD)">
                <input className="campo" inputMode="tel" value={editando.telefone} onChange={(e) => setEditando({ ...editando, telefone: e.target.value })} />
              </Campo>
              <Campo rotulo="Atividade">
                <select className="campo" value={editando.atividade} onChange={(e) => setEditando({ ...editando, atividade: e.target.value as Atividade })}>
                  {Object.entries(ATIVIDADES).map(([id, nome]) => (
                    <option key={id} value={id}>
                      {nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Mensalidade (R$)">
                <input
                  key={editando.id}
                  className="campo"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={editando.mensalidade ? editando.mensalidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                  onChange={(e) => setEditando({ ...editando, mensalidade: Math.max(0, parseMoney(e.target.value) || 0) })}
                />
              </Campo>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--verde)]" checked={editando.ativo} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} />
              Cliente ativo
            </label>
            <div className="flex gap-3 pt-2">
              {existe && (
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-red-400/50 px-4 py-3 text-sm text-red-300" onClick={() => excluir(editando)}>
                  <Trash2 size={16} /> Excluir
                </button>
              )}
              <button type="submit" className="btn-verde flex-1 px-4 py-3">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const Campo = ({ rotulo, children }: { rotulo: string; children: ReactNode }) => (
  <label className="block text-sm text-slate-300">
    <span className="mb-1 block">{rotulo}</span>
    {children}
  </label>
)

function Ajustes({ dados, set }: { dados: Dados; set: Set }) {
  const exportar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `carteira-mei-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const importar = async (arquivo?: File) => {
    if (!arquivo) return
    try {
      const novo = JSON.parse(await arquivo.text())
      if (!Array.isArray(novo.meis)) throw new Error()
      if (window.confirm('Substituir todos os dados atuais pelo conteúdo do arquivo?')) set((d) => ({ ...d, ...novo }))
    } catch {
      window.alert('Arquivo inválido.')
    }
  }
  return (
    <div className="space-y-4">
      <section className="cartao p-5">
        <h2 className="font-semibold">Cálculo do DAS</h2>
        <p className="mt-1 text-sm text-slate-400">5% do salário mínimo, mais R$ 1,00 (ICMS) e/ou R$ 5,00 (ISS) conforme a atividade.</p>
        <div className="mt-3 max-w-xs">
          <Campo rotulo="Salário mínimo vigente (R$)">
            <input
              className="campo"
              inputMode="decimal"
              defaultValue={dados.salarioMinimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              onBlur={(e) => {
                const v = parseMoney(e.target.value)
                if (v > 0) set((d) => ({ ...d, salarioMinimo: v }))
              }}
            />
          </Campo>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Comércio {money(valorDas(dados.salarioMinimo, 'comercio'))} · Serviços {money(valorDas(dados.salarioMinimo, 'servico'))} · Ambos{' '}
          {money(valorDas(dados.salarioMinimo, 'ambos'))}
        </p>
      </section>
      <section className="cartao p-5">
        <h2 className="font-semibold">Dados</h2>
        <p className="mt-1 text-sm text-slate-400">Tudo fica salvo neste aparelho. Faça um backup de vez em quando.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-contorno px-4 py-2.5 text-sm" onClick={exportar}>
            Baixar backup
          </button>
          <label className="btn-contorno cursor-pointer px-4 py-2.5 text-sm">
            Restaurar backup
            <input type="file" accept="application/json" className="hidden" onChange={(e) => importar(e.target.files?.[0])} />
          </label>
          <button
            className="rounded-xl border border-[var(--borda)] px-4 py-2.5 text-sm text-slate-200"
            onClick={() => window.confirm('Substituir os dados atuais pela carteira de exemplo?') && set(() => dadosExemplo(todayISO().slice(0, 7)))}
          >
            Carregar exemplo
          </button>
          <button
            className="rounded-xl border border-red-400/50 px-4 py-2.5 text-sm text-red-300"
            onClick={() => window.confirm('Apagar todos os clientes e lançamentos?') && set((d) => ({ ...d, meis: [], dasPago: {}, mensRecebida: {}, faturamento: {}, dasnEntregue: {} }))}
          >
            Apagar tudo
          </button>
        </div>
      </section>
    </div>
  )
}
