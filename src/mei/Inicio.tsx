import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock, FileText, Landmark, MessageCircle, Plus, Wallet } from 'lucide-react'
import { fmtDate, money, monthLabel, shiftMonth, todayISO } from '../lib/utils'
import { useDados } from './dados'
import { LIMITE, diasAte } from './lib'
import { FormLancamento, LinhaLancamento } from './Financeiro'
import { FormNota } from './Notas'
import { BarrasAno, Botao, MedidorLimite, Tile } from './ui'

export default function Inicio() {
  const { perfil, lancamentos, notas, dasPagos, dasn, das } = useDados()
  const [form, setForm] = useState<'nota' | 'receita' | 'despesa' | null>(null)
  const hoje = todayISO()
  const mes = hoje.slice(0, 7)
  const ano = hoje.slice(0, 4)

  const r = useMemo(() => {
    const entradas = Array(12).fill(0) as number[]
    const saidas = Array(12).fill(0) as number[]
    for (const l of lancamentos) {
      if (!l.data.startsWith(ano)) continue
      const i = Number(l.data.slice(5, 7)) - 1
      if (l.tipo === 'receita') entradas[i] += l.valor
      else saidas[i] += l.valor
    }
    const i = Number(mes.slice(5)) - 1
    const totalAno = entradas.reduce((a, b) => a + b, 0)
    return { entradas, saidas, recMes: entradas[i], despMes: saidas[i], totalAno, projecao: (totalAno / (i + 1)) * 12 }
  }, [lancamentos, ano, mes])
  const notasMes = notas.filter((n) => n.status === 'emitida' && n.data_emissao.startsWith(mes))

  // Obrigações: DAS do mês anterior vence dia 20 deste mês; DASN do ano anterior vence em 31/05.
  const comp = shiftMonth(mes, -1)
  const vencDas = `${mes}-20`
  const dasPago = dasPagos.has(comp)
  const anoDasn = Number(ano) - 1
  const decl = dasn.find((x) => x.ano === anoDasn)
  const criadoAntes = perfil!.criado_em.slice(0, 4) <= String(anoDasn) || lancamentos.some((l) => l.data.startsWith(String(anoDasn)))
  const pct = (r.totalAno / LIMITE) * 100

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--tinta-2)]">{monthLabel(mes)}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Olá, {perfil!.nome.split(' ')[0] || 'empreendedor'} 👋</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao className="btn-neutro" onClick={() => setForm('despesa')}>
            <Plus size={16} /> Saída
          </Botao>
          <Botao className="btn-neutro" onClick={() => setForm('receita')}>
            <Plus size={16} /> Entrada
          </Botao>
          <Botao className="btn-verde" onClick={() => setForm('nota')}>
            <FileText size={16} /> Emitir nota
          </Botao>
        </div>
      </div>

      {pct >= 80 && (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${pct > 100 ? 'border-red-400/40 bg-red-500/10 text-red-100' : 'border-amber-300/40 bg-amber-400/10 text-amber-100'}`}>
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <p>{pct > 100 ? 'Seu faturamento passou do limite anual do MEI. Fale com o contador para avaliar o desenquadramento e evitar multas.' : `Você já usou ${Math.round(pct)}% do limite anual do MEI. Planeje os próximos meses para não ultrapassar R$ 81 mil.`}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile rotulo="Entradas do mês" valor={money(r.recMes)} icone={<ArrowUpCircle size={18} />} />
        <Tile rotulo="Saídas do mês" valor={money(r.despMes)} icone={<ArrowDownCircle size={18} />} />
        <Tile rotulo="Resultado" valor={money(r.recMes - r.despMes)} detalhe="entradas menos saídas" icone={<Wallet size={18} />} />
        <Tile rotulo="Notas no mês" valor={String(notasMes.length)} detalhe={money(notasMes.reduce((s, n) => s + n.valor, 0))} icone={<FileText size={18} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="cartao p-5 sm:p-6">
          <p className="rotulo">Faturamento em {ano}</p>
          <h2 className="mb-4 mt-1 text-lg font-bold">Limite anual do MEI</h2>
          <MedidorLimite total={r.totalAno} projecao={r.projecao} />
          <h2 className="mb-3 mt-8 text-lg font-bold">Entradas e saídas por mês</h2>
          <BarrasAno entradas={r.entradas} saidas={r.saidas} ano={ano} />
        </section>

        <div className="space-y-6">
          <section className="cartao p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <CalendarClock size={18} className="text-[var(--verde)]" /> Próximas obrigações
            </h2>
            <ul className="divide-y divide-[var(--borda)] text-sm">
              <li className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">DAS de {monthLabel(comp).toLowerCase()}</p>
                  <p className="text-xs text-[var(--tinta-3)]">
                    {money(das)} · vence {fmtDate(vencDas)}
                  </p>
                </div>
                <a href="#/app/impostos" className={`chip ${dasPago ? 'chip-bom' : diasAte(vencDas) < 0 ? 'chip-critico' : diasAte(vencDas) <= 5 ? 'chip-alerta' : ''}`}>
                  {dasPago ? 'Pago' : diasAte(vencDas) < 0 ? 'Atrasado' : diasAte(vencDas) === 0 ? 'Vence hoje' : `Em ${diasAte(vencDas)} dias`}
                </a>
              </li>
              {criadoAntes && (
                <li className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">Declaração anual {anoDasn}</p>
                    <p className="text-xs text-[var(--tinta-3)]">DASN-SIMEI · prazo 31/05/{ano}</p>
                  </div>
                  <a href="#/app/impostos" className={`chip ${decl?.status === 'entregue' ? 'chip-bom' : decl ? 'chip-alerta' : hoje > `${ano}-05-31` ? 'chip-critico' : ''}`}>
                    {decl?.status === 'entregue' ? 'Entregue' : decl ? 'Com o contador' : hoje > `${ano}-05-31` ? 'Atrasada' : 'A solicitar'}
                  </a>
                </li>
              )}
            </ul>
            <a href="#/app/impostos" className="btn btn-neutro mt-3 w-full">
              <Landmark size={16} /> Ver impostos
            </a>
          </section>

          {!perfil!.whatsapp && (
            <a href="#/app/whatsapp" className="cartao flex items-center gap-4 border-[var(--verde)]/40 p-5 transition hover:border-[var(--verde)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--verde)] text-[var(--verde-escuro)]">
                <MessageCircle size={22} />
              </span>
              <span>
                <span className="block font-bold">Emita notas pelo WhatsApp</span>
                <span className="text-sm text-[var(--tinta-2)]">Conecte seu número e experimente.</span>
              </span>
            </a>
          )}
        </div>
      </div>

      <section className="cartao p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Últimos lançamentos</h2>
          <a href="#/app/financeiro" className="text-sm font-medium text-[var(--verde)]">
            Ver tudo
          </a>
        </div>
        {lancamentos.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--tinta-3)]">Nada por aqui ainda. Emita uma nota ou registre uma entrada para começar.</p>
        ) : (
          <ul className="mt-1 divide-y divide-[var(--borda)]">
            {lancamentos.slice(0, 6).map((l) => (
              <LinhaLancamento key={l.id} l={l} />
            ))}
          </ul>
        )}
      </section>

      {form === 'nota' && <FormNota onClose={() => setForm(null)} />}
      {(form === 'receita' || form === 'despesa') && <FormLancamento tipo={form} onClose={() => setForm(null)} />}
    </div>
  )
}
