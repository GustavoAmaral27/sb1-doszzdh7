import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, FileCheck2, Send } from 'lucide-react'
import { fmtDate, money, monthLabel, parseMoney, shiftMonth, todayISO } from '../lib/utils'
import { useDados } from './dados'
import { supabase } from './lib'
import { Abas, Botao, Cabecalho, Campo, Tile, tentar } from './ui'

const PGMEI = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao'
const br = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

function Das() {
  const { perfil, dasPagos, das, recarregar } = useDados()
  const hoje = todayISO()
  const inicio = shiftMonth(perfil!.criado_em.slice(0, 7), -1)
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)))
  const [ocupado, setOcupado] = useState('')
  const meses = Array.from({ length: 12 }, (_, i) => {
    const comp = `${ano}-${String(i + 1).padStart(2, '0')}`
    const venc = `${shiftMonth(comp, 1)}-20`
    const pago = dasPagos.has(comp)
    // Meses anteriores ao cadastro não contam como atraso: não sabemos se foram pagos.
    const estado: 'pago' | 'futuro' | 'atrasado' | 'aberto' | 'antes' = pago ? 'pago' : comp > hoje.slice(0, 7) ? 'futuro' : comp < inicio ? 'antes' : venc < hoje ? 'atrasado' : 'aberto'
    return { comp, venc, pago, estado }
  })
  const alternar = async (comp: string, pago: boolean) => {
    setOcupado(comp)
    await tentar(async () => {
      const { error } = pago ? await supabase.from('mei_das').delete().eq('competencia', comp) : await supabase.from('mei_das').upsert({ competencia: comp, pago: true, pago_em: todayISO() })
      if (error) throw new Error('Não foi possível atualizar.')
      await recarregar()
    })
    setOcupado('')
  }
  const CHIP = { pago: ['Pago', 'chip-bom'], futuro: ['A vencer', ''], atrasado: ['Atrasado', 'chip-critico'], aberto: ['Em aberto', 'chip-alerta'], antes: ['Sem registro', ''] } as const

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile rotulo="Valor mensal do DAS" valor={money(das)} detalhe="INSS + ISS/ICMS, valor fixo" />
        <Tile rotulo={`Pagos em ${ano}`} valor={`${meses.filter((m) => m.pago).length} de 12`} detalhe={money(meses.filter((m) => m.pago).length * das)} />
        <Tile rotulo="Em atraso" valor={String(meses.filter((m) => m.estado === 'atrasado').length)} detalhe="guias vencidas sem pagamento" />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--borda)] bg-[var(--painel)] p-1 text-sm">
          <button aria-label="Ano anterior" className="rounded-lg p-2 hover:bg-white/10" onClick={() => setAno(ano - 1)}>
            <ChevronLeft size={18} />
          </button>
          <span className="num min-w-[4rem] text-center font-semibold">{ano}</span>
          <button aria-label="Próximo ano" className="rounded-lg p-2 hover:bg-white/10" onClick={() => setAno(ano + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
        <a className="btn btn-contorno" href={PGMEI} target="_blank" rel="noreferrer">
          Gerar guia no PGMEI <ExternalLink size={15} />
        </a>
      </div>
      <ul className="cartao mt-3 divide-y divide-[var(--borda)] px-4">
        {meses.map((m) => (
          <li key={m.comp} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{monthLabel(m.comp)}</p>
              <p className="text-xs text-[var(--tinta-3)]">Vence em {fmtDate(m.venc)}</p>
            </div>
            <span className={`chip ${CHIP[m.estado][1]}`}>{CHIP[m.estado][0]}</span>
            <Botao className="btn-neutro min-w-[7.5rem] px-3 py-2 text-xs" ocupado={ocupado === m.comp} onClick={() => alternar(m.comp, m.pago)}>
              {m.pago ? 'Desfazer' : 'Marcar pago'}
            </Botao>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--tinta-3)]">O DAS vence todo dia 20 do mês seguinte. A guia oficial (boleto ou Pix) é gerada no PGMEI, da Receita Federal.</p>
    </div>
  )
}

function Declaracao() {
  const { perfil, lancamentos, dasn, recarregar } = useDados()
  const anoAtual = Number(todayISO().slice(0, 4))
  const [ano, setAno] = useState(anoAtual - 1)
  const existente = dasn.find((d) => d.ano === ano)
  const calc = useMemo(() => {
    let comercio = 0
    let servico = 0
    for (const l of lancamentos) {
      if (l.tipo !== 'receita' || !l.data.startsWith(String(ano))) continue
      if (l.natureza === 'comercio') comercio += l.valor
      else servico += l.valor
    }
    return { comercio, servico }
  }, [lancamentos, ano])
  const [edit, setEdit] = useState<{ ano: number; comercio: string; servico: string; empregado: boolean } | null>(null)
  const f = edit?.ano === ano ? edit : { ano, comercio: br(existente?.receita_comercio ?? calc.comercio), servico: br(existente?.receita_servico ?? calc.servico), empregado: existente?.teve_empregado ?? perfil!.tem_empregado }
  const total = (parseMoney(f.comercio) || 0) + (parseMoney(f.servico) || 0)
  const [ocupado, setOcupado] = useState(false)

  const solicitar = async () => {
    setOcupado(true)
    await tentar(async () => {
      const linha = { ano, receita_comercio: parseMoney(f.comercio) || 0, receita_servico: parseMoney(f.servico) || 0, teve_empregado: f.empregado }
      const { error } = existente ? await supabase.from('mei_dasn').update(linha).eq('id', existente.id) : await supabase.from('mei_dasn').insert(linha)
      if (error) throw new Error('Não foi possível enviar a solicitação.')
      await recarregar()
      setEdit(null)
    }, existente ? 'Valores atualizados.' : 'Solicitação enviada ao contador.')
    setOcupado(false)
  }
  const desistir = async () => {
    if (!existente || !window.confirm('Cancelar a solicitação de entrega?')) return
    await tentar(async () => {
      const { error } = await supabase.from('mei_dasn').delete().eq('id', existente.id)
      if (error) throw new Error('Não foi possível cancelar.')
      await recarregar()
    }, 'Solicitação cancelada.')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="cartao p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="rotulo">DASN-SIMEI</p>
            <h2 className="mt-1 text-xl font-bold">Declaração anual de {ano}</h2>
          </div>
          <select className="campo w-auto" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano da declaração">
            {[anoAtual - 1, anoAtual - 2, anoAtual - 3].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>

        {existente?.status === 'entregue' ? (
          <div className="mt-5 rounded-2xl border border-[var(--verde)]/40 bg-[var(--verde)]/10 p-5">
            <p className="flex items-center gap-2 font-bold text-[var(--verde)]">
              <CheckCircle2 size={20} /> Declaração entregue
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--tinta-3)]">Faturamento declarado</dt>
                <dd className="num font-semibold">{money(existente.receita_comercio + existente.receita_servico)}</dd>
              </div>
              <div>
                <dt className="text-[var(--tinta-3)]">Recibo</dt>
                <dd className="font-mono font-semibold">{existente.recibo || '—'}</dd>
              </div>
              {existente.entregue_em && (
                <div>
                  <dt className="text-[var(--tinta-3)]">Entregue em</dt>
                  <dd className="font-semibold">{fmtDate(existente.entregue_em.slice(0, 10))}</dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <>
            {existente && (
              <p className="mt-5 flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                <Send size={16} className="shrink-0" /> Solicitação recebida em {fmtDate(existente.solicitada_em.slice(0, 10))}. O contador fará a entrega e o recibo aparecerá aqui.
              </p>
            )}
            <p className="mt-5 text-sm text-[var(--tinta-2)]">Estes valores vieram das suas entradas de {ano}. Confira e ajuste se faltou registrar alguma venda.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Receita de comércio e indústria (R$)">
                <input className="campo num" inputMode="decimal" value={f.comercio} onChange={(e) => setEdit({ ...f, comercio: e.target.value })} />
              </Campo>
              <Campo rotulo="Receita de serviços (R$)">
                <input className="campo num" inputMode="decimal" value={f.servico} onChange={(e) => setEdit({ ...f, servico: e.target.value })} />
              </Campo>
            </div>
            <label className="mt-4 flex items-center gap-2.5 text-sm text-[var(--tinta-2)]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--verde)]" checked={f.empregado} onChange={(e) => setEdit({ ...f, empregado: e.target.checked })} />
              Tive funcionário registrado em {ano}
            </label>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span className="text-sm text-[var(--tinta-2)]">Faturamento bruto total</span>
              <span className="num titulo text-xl font-bold">{money(total)}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Botao className="btn-verde px-6 py-3" ocupado={ocupado} onClick={solicitar}>
                <FileCheck2 size={18} /> {existente ? 'Atualizar valores' : 'Solicitar entrega ao contador'}
              </Botao>
              {existente && (
                <Botao className="btn-perigo" onClick={desistir}>
                  Cancelar solicitação
                </Botao>
              )}
            </div>
          </>
        )}
      </section>
      <aside className="cartao h-fit space-y-3 p-5 text-sm text-[var(--tinta-2)]">
        <h3 className="font-bold text-[var(--tinta)]">Como funciona</h3>
        <p>Todo MEI precisa declarar, até <b className="text-[var(--tinta)]">31 de maio</b>, quanto faturou no ano anterior, mesmo que não tenha faturado nada.</p>
        <p>Você confere os valores e solicita a entrega. Nosso contador transmite a declaração à Receita Federal e o número do recibo fica guardado aqui.</p>
        <p>Entregar fora do prazo gera multa. Deixe para a gente lembrar você.</p>
      </aside>
    </div>
  )
}

export default function Impostos() {
  const [aba, setAba] = useState<'das' | 'dasn'>('das')
  return (
    <div>
      <Cabecalho titulo="Impostos" sub="DAS mensal e declaração anual do seu MEI." />
      <Abas
        abas={[
          ['das', 'DAS mensal'],
          ['dasn', 'Declaração anual'],
        ]}
        atual={aba}
        onChange={setAba}
      />
      {aba === 'das' ? <Das /> : <Declaracao />}
    </div>
  )
}
