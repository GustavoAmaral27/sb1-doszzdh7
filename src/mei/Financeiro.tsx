import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, FileText, MessageCircle, Plus, Trash2, Wallet } from 'lucide-react'
import { cn, fmtDate, money, monthLabel, parseMoney, shiftMonth, todayISO } from '../lib/utils'
import { useDados } from './dados'
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, supabase, type Lancamento } from './lib'
import { Abas, BarrasCategoria, Botao, Cabecalho, Campo, Modal, Tile, Vazio, avisar, tentar } from './ui'

export function FormLancamento({ tipo, inicial, onClose }: { tipo: 'receita' | 'despesa'; inicial?: Lancamento; onClose: () => void }) {
  const { perfil, recarregar } = useDados()
  const categorias = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA
  const [f, setF] = useState({
    descricao: inicial?.descricao ?? '',
    categoria: inicial?.categoria ?? (tipo === 'receita' ? (perfil!.atividade === 'comercio' ? 'Venda de produtos' : 'Prestação de serviços') : 'Mercadorias e materiais'),
    valor: inicial ? inicial.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
    data: inicial?.data ?? todayISO(),
  })
  const [ocupado, setOcupado] = useState(false)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseMoney(f.valor)
    if (!(valor > 0)) return avisar('Informe um valor maior que zero.', true)
    setOcupado(true)
    const linha = {
      tipo,
      descricao: f.descricao.trim(),
      categoria: f.categoria,
      valor,
      data: f.data,
      natureza: f.categoria === 'Venda de produtos' || (f.categoria === 'Outras receitas' && perfil!.atividade === 'comercio') ? 'comercio' : 'servico',
    }
    const ok = await tentar(async () => {
      const { error } = inicial ? await supabase.from('mei_lancamentos').update(linha).eq('id', inicial.id) : await supabase.from('mei_lancamentos').insert(linha)
      if (error) throw new Error('Não foi possível salvar o lançamento.')
      await recarregar()
    }, 'Lançamento salvo.')
    setOcupado(false)
    if (ok) onClose()
  }
  const apagar = async () => {
    if (!inicial || !window.confirm('Apagar este lançamento?')) return
    const ok = await tentar(async () => {
      const { error } = await supabase.from('mei_lancamentos').delete().eq('id', inicial.id)
      if (error) throw new Error('Não foi possível apagar.')
      await recarregar()
    }, 'Lançamento apagado.')
    if (ok) onClose()
  }

  return (
    <Modal titulo={`${inicial ? 'Editar' : 'Nova'} ${tipo === 'receita' ? 'entrada' : 'saída'}`} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Valor (R$)">
          <input className="campo num text-xl font-semibold" inputMode="decimal" placeholder="0,00" required autoFocus value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </Campo>
        <Campo rotulo="Descrição">
          <input className="campo" required placeholder={tipo === 'receita' ? 'Ex.: Serviço para João' : 'Ex.: Compra de material'} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Categoria">
            <select className="campo" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {(categorias.includes(f.categoria) ? categorias : [f.categoria, ...categorias]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data">
            <input className="campo" type="date" required value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
          </Campo>
        </div>
        <div className="flex gap-3 pt-1">
          {inicial && (
            <Botao type="button" className="btn-perigo" onClick={apagar}>
              <Trash2 size={16} /> Apagar
            </Botao>
          )}
          <Botao type="submit" ocupado={ocupado} className="btn-verde flex-1 py-3">
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

export function LinhaLancamento({ l, onClick }: { l: Lancamento; onClick?: () => void }) {
  const receita = l.tipo === 'receita'
  return (
    <li>
      <button className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default" onClick={onClick} disabled={!onClick}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: receita ? 'rgba(57,135,229,0.15)' : 'rgba(217,89,38,0.15)', color: receita ? '#79b0f2' : '#f0936a' }}>
          {receita ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{l.descricao}</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--tinta-3)]">
            {fmtDate(l.data)} · {l.categoria}
            {l.nota_id && <FileText size={12} aria-label="Gerado por nota fiscal" />}
            {l.origem === 'whatsapp' && <MessageCircle size={12} aria-label="Lançado pelo WhatsApp" />}
          </span>
        </span>
        <span className="num shrink-0 text-sm font-semibold">
          {receita ? '+' : '−'} {money(l.valor)}
        </span>
      </button>
    </li>
  )
}

export default function Financeiro() {
  const { lancamentos } = useDados()
  const [mes, setMes] = useState(todayISO().slice(0, 7))
  const [filtro, setFiltro] = useState<'tudo' | 'receita' | 'despesa'>('tudo')
  const [form, setForm] = useState<{ tipo: 'receita' | 'despesa'; inicial?: Lancamento } | null>(null)

  const doMes = useMemo(() => lancamentos.filter((l) => l.data.startsWith(mes)), [lancamentos, mes])
  const entradas = doMes.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
  const saidas = doMes.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)
  const categorias = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of doMes) if (l.tipo === 'despesa') m.set(l.categoria, (m.get(l.categoria) ?? 0) + l.valor)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [doMes])
  const lista = doMes.filter((l) => filtro === 'tudo' || l.tipo === filtro)

  return (
    <div>
      <Cabecalho titulo="Financeiro" sub="Tudo o que entrou e saiu do seu negócio.">
        <Botao className="btn-neutro" onClick={() => setForm({ tipo: 'despesa' })}>
          <Plus size={16} /> Saída
        </Botao>
        <Botao className="btn-verde" onClick={() => setForm({ tipo: 'receita' })}>
          <Plus size={16} /> Entrada
        </Botao>
      </Cabecalho>

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl border border-[var(--borda)] bg-[var(--painel)] p-1 text-sm">
        <button aria-label="Mês anterior" className="rounded-lg p-2 hover:bg-white/10" onClick={() => setMes(shiftMonth(mes, -1))}>
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-[9.5rem] text-center font-semibold">{monthLabel(mes)}</span>
        <button aria-label="Próximo mês" className="rounded-lg p-2 hover:bg-white/10" onClick={() => setMes(shiftMonth(mes, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile rotulo="Entradas" valor={money(entradas)} icone={<ArrowUpCircle size={18} />} />
        <Tile rotulo="Saídas" valor={money(saidas)} icone={<ArrowDownCircle size={18} />} />
        <Tile rotulo="Resultado do mês" valor={money(entradas - saidas)} detalhe={entradas > 0 ? `Margem de ${Math.round(((entradas - saidas) / entradas) * 100)}%` : undefined} icone={<Wallet size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <Abas
            abas={[
              ['tudo', 'Tudo'],
              ['receita', 'Entradas'],
              ['despesa', 'Saídas'],
            ]}
            atual={filtro}
            onChange={setFiltro}
          />
          {lista.length === 0 ? (
            <Vazio icone={<Wallet size={26} />} titulo="Nada lançado neste mês" texto='Registre entradas e saídas por aqui ou pelo WhatsApp ("gastei 50 gasolina").' />
          ) : (
            <ul className="cartao divide-y divide-[var(--borda)] px-4">
              {lista.map((l) => (
                <LinhaLancamento key={l.id} l={l} onClick={l.nota_id ? () => avisar('Esta entrada veio de uma nota fiscal. Para removê-la, cancele a nota.') : () => setForm({ tipo: l.tipo, inicial: l })} />
              ))}
            </ul>
          )}
        </section>
        <section className={cn('cartao h-fit p-5', categorias.length === 0 && 'hidden lg:block')}>
          <h2 className="mb-4 font-bold">Para onde foi o dinheiro</h2>
          {categorias.length ? <BarrasCategoria itens={categorias} /> : <p className="text-sm text-[var(--tinta-3)]">Sem saídas neste mês.</p>}
        </section>
      </div>
      {form && <FormLancamento {...form} onClose={() => setForm(null)} />}
    </div>
  )
}
