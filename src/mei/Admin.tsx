import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileCheck2, Search } from 'lucide-react'
import { fmtDate, money, toISO, todayISO } from '../lib/utils'
import { useDados } from './dados'
import { acessoLiberado, fmtDoc, supabase, type Dasn, type Perfil } from './lib'
import { Abas, Botao, Cabecalho, Campo, Tile, Vazio, tentar } from './ui'

const emDias = (n: number) => toISO(new Date(Date.now() + n * 864e5))
const PLANO: Record<Perfil['plano'], [string, string]> = { ativo: ['Ativo', 'chip-bom'], trial: ['Teste', 'chip-alerta'], atrasado: ['Atrasado', 'chip-critico'], cancelado: ['Cancelado', 'chip-critico'] }

/** Área do contador: assinantes, declarações a entregar e configurações do produto. */
export default function Admin() {
  const { config, preco, recarregar } = useDados()
  const [aba, setAba] = useState<'assinantes' | 'dasn' | 'config'>('assinantes')
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [dasn, setDasn] = useState<Dasn[]>([])
  const [busca, setBusca] = useState('')
  const [recibos, setRecibos] = useState<Record<string, string>>({})
  const [cfg, setCfg] = useState(config)
  const [ocupado, setOcupado] = useState('')

  const carregar = useCallback(async () => {
    const [p, d] = await Promise.all([supabase.from('mei_perfis').select().order('criado_em', { ascending: false }), supabase.from('mei_dasn').select().order('solicitada_em')])
    recarregar() // a própria conta do contador também pode ter mudado
    setPerfis((p.data ?? []) as Perfil[])
    setDasn(((d.data ?? []) as Dasn[]).map((x) => ({ ...x, receita_comercio: Number(x.receita_comercio), receita_servico: Number(x.receita_servico) })))
  }, [recarregar])
  useEffect(() => {
    carregar()
  }, [carregar])

  const mudar = async (id: string, mudanca: Partial<Perfil>, msg: string) => {
    setOcupado(id)
    await tentar(async () => {
      const { error } = await supabase.from('mei_perfis').update(mudanca).eq('user_id', id)
      if (error) throw new Error('Não foi possível atualizar o assinante.')
      await carregar()
    }, msg)
    setOcupado('')
  }
  const entregar = async (d: Dasn) => {
    setOcupado(d.id)
    await tentar(async () => {
      const { error } = await supabase.from('mei_dasn').update({ status: 'entregue', recibo: (recibos[d.id] ?? '').trim(), entregue_em: new Date().toISOString() }).eq('id', d.id)
      if (error) throw new Error('Não foi possível marcar como entregue.')
      await carregar()
    }, 'Declaração marcada como entregue.')
    setOcupado('')
  }
  const salvarCfg = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado('cfg')
    await tentar(async () => {
      const { error } = await supabase.from('mei_config').upsert(Object.entries(cfg).map(([chave, valor]) => ({ chave, valor: String(valor).trim().replace(',', '.') })))
      if (error) throw new Error('Não foi possível salvar as configurações.')
    }, 'Configurações salvas. Recarregue a página para ver os novos valores.')
    setOcupado('')
  }

  const ativos = perfis.filter((p) => p.plano === 'ativo')
  const pendentes = dasn.filter((d) => d.status === 'solicitada')
  const q = busca.trim().toLowerCase()
  const lista = q ? perfis.filter((p) => `${p.nome} ${p.razao_social} ${p.cnpj} ${p.email}`.toLowerCase().includes(q)) : perfis
  const dono = (id: string) => perfis.find((p) => p.user_id === id)

  return (
    <div>
      <Cabecalho titulo="Área do contador" sub="Visível só para administradores." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile rotulo="Receita recorrente" valor={money(ativos.length * preco)} detalhe={`${ativos.length} assinatura${ativos.length === 1 ? '' : 's'} ativa${ativos.length === 1 ? '' : 's'}`} />
        <Tile rotulo="Cadastros" valor={String(perfis.length)} detalhe="contas criadas" />
        <Tile rotulo="Em teste" valor={String(perfis.filter((p) => p.plano === 'trial' && acessoLiberado(p)).length)} detalhe="dentro do período grátis" />
        <Tile rotulo="Declarações a entregar" valor={String(pendentes.length)} detalhe="solicitadas pelos clientes" />
      </div>
      <Abas
        abas={[
          ['assinantes', 'Assinantes'],
          ['dasn', `Declarações (${pendentes.length})`],
          ['config', 'Configurações'],
        ]}
        atual={aba}
        onChange={setAba}
      />

      {aba === 'assinantes' && (
        <>
          <div className="relative mb-3">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tinta-3)]" />
            <input className="campo pl-10" placeholder="Buscar por nome, CNPJ ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar assinantes" />
          </div>
          <ul className="space-y-3">
            {lista.map((p) => (
              <li key={p.user_id} className="cartao flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-medium">{p.razao_social || p.nome || p.email}</p>
                  <p className="truncate text-xs text-[var(--tinta-3)]">{[fmtDoc(p.cnpj), p.email, p.whatsapp && 'WhatsApp conectado'].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="text-right">
                  <span className={`chip ${p.plano === 'trial' && !acessoLiberado(p) ? 'chip-critico' : PLANO[p.plano][1]}`}>{p.plano === 'trial' && !acessoLiberado(p) ? 'Teste vencido' : PLANO[p.plano][0]}</span>
                  <p className="mt-1 text-xs text-[var(--tinta-3)]">{p.plano === 'ativo' ? (p.pago_ate ? `até ${fmtDate(p.pago_ate)}` : 'sem vencimento') : p.plano === 'trial' ? `teste até ${fmtDate(p.trial_ate)}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <Botao className="btn-neutro px-3 py-2 text-xs" ocupado={ocupado === p.user_id} onClick={() => mudar(p.user_id, { plano: 'ativo', pago_ate: emDias(30) }, 'Assinatura ativada por 30 dias.')}>
                    Ativar 30 dias
                  </Botao>
                  {p.plano === 'trial' && (
                    <Botao className="btn-neutro px-3 py-2 text-xs" onClick={() => mudar(p.user_id, { trial_ate: emDias(7) }, 'Teste estendido por 7 dias.')}>
                      +7 dias de teste
                    </Botao>
                  )}
                  {p.plano === 'ativo' && (
                    <Botao className="btn-perigo px-3 py-2 text-xs" onClick={() => window.confirm('Suspender esta assinatura?') && mudar(p.user_id, { plano: 'cancelado' }, 'Assinatura suspensa.')}>
                      Suspender
                    </Botao>
                  )}
                </div>
              </li>
            ))}
            {lista.length === 0 && <li className="cartao p-6 text-center text-sm text-[var(--tinta-3)]">Nenhum assinante encontrado.</li>}
          </ul>
        </>
      )}

      {aba === 'dasn' &&
        (dasn.length === 0 ? (
          <Vazio icone={<FileCheck2 size={26} />} titulo="Nenhuma declaração solicitada" texto="Quando um cliente pedir a entrega da DASN-SIMEI, ela aparece aqui com os valores prontos." />
        ) : (
          <ul className="space-y-3">
            {[...pendentes, ...dasn.filter((d) => d.status === 'entregue')].map((d) => {
              const p = dono(d.user_id)
              return (
                <li key={d.id} className="cartao p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {p?.razao_social || p?.email || 'Cliente'} · {d.ano}
                      </p>
                      <p className="text-xs text-[var(--tinta-3)]">
                        CNPJ {fmtDoc(p?.cnpj ?? '')} · solicitada em {fmtDate(d.solicitada_em.slice(0, 10))}
                      </p>
                    </div>
                    <span className={`chip ${d.status === 'entregue' ? 'chip-bom' : 'chip-alerta'}`}>{d.status === 'entregue' ? `Entregue · ${d.recibo || 'sem recibo'}` : 'A entregar'}</span>
                  </div>
                  <dl className="num mt-3 grid gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-[var(--tinta-3)]">Comércio/indústria</dt>
                      <dd className="font-semibold">{money(d.receita_comercio)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--tinta-3)]">Serviços</dt>
                      <dd className="font-semibold">{money(d.receita_servico)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--tinta-3)]">Total</dt>
                      <dd className="font-semibold">{money(d.receita_comercio + d.receita_servico)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--tinta-3)]">Teve empregado</dt>
                      <dd className="font-semibold">{d.teve_empregado ? 'Sim' : 'Não'}</dd>
                    </div>
                  </dl>
                  {d.status === 'solicitada' && (
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <a className="btn btn-neutro" href="https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao" target="_blank" rel="noreferrer">
                        Abrir DASN-SIMEI <ExternalLink size={15} />
                      </a>
                      <input className="campo max-w-[14rem]" placeholder="Nº do recibo" aria-label="Número do recibo" value={recibos[d.id] ?? ''} onChange={(e) => setRecibos({ ...recibos, [d.id]: e.target.value })} />
                      <Botao className="btn-verde" ocupado={ocupado === d.id} onClick={() => entregar(d)}>
                        Marcar como entregue
                      </Botao>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ))}

      {aba === 'config' && (
        <form onSubmit={salvarCfg} className="cartao grid max-w-2xl gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Campo rotulo="Preço mensal (R$)">
            <input className="campo num" inputMode="decimal" value={cfg.preco_mensal} onChange={(e) => setCfg({ ...cfg, preco_mensal: e.target.value })} />
          </Campo>
          <Campo rotulo="Dias de teste grátis">
            <input className="campo num" inputMode="numeric" value={cfg.dias_teste} onChange={(e) => setCfg({ ...cfg, dias_teste: e.target.value })} />
          </Campo>
          <Campo rotulo="Salário mínimo (base do DAS)">
            <input className="campo num" inputMode="decimal" value={cfg.salario_minimo} onChange={(e) => setCfg({ ...cfg, salario_minimo: e.target.value })} />
          </Campo>
          <div />
          <Campo rotulo="WhatsApp do robô" dica="Número com DDI e DDD, só dígitos. Ex.: 5511999990000">
            <input className="campo num" inputMode="numeric" value={cfg.whatsapp_bot} onChange={(e) => setCfg({ ...cfg, whatsapp_bot: e.target.value })} />
          </Campo>
          <Campo rotulo="WhatsApp de suporte e vendas" dica="Usado no botão Assinar enquanto não houver pagamento online.">
            <input className="campo num" inputMode="numeric" value={cfg.whatsapp_suporte} onChange={(e) => setCfg({ ...cfg, whatsapp_suporte: e.target.value })} />
          </Campo>
          <Botao type="submit" className="btn-verde sm:col-span-2 sm:w-fit sm:px-8" ocupado={ocupado === 'cfg'}>
            Salvar configurações
          </Botao>
          <p className="text-xs text-[var(--tinta-3)] sm:col-span-2">Hoje: {todayISO().split('-').reverse().join('/')}. As chaves de integração (WhatsApp, pagamento e nota fiscal) ficam nos segredos do servidor, não aqui.</p>
        </form>
      )}
    </div>
  )
}
