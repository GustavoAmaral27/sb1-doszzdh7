import { ArrowRight, BarChart3, CalendarCheck, Check, CheckCheck, FileText, Gauge, Landmark, MessageCircle, ShieldCheck } from 'lucide-react'
import { money } from '../lib/utils'
import { useDados } from './dados'
import { MARCA } from './lib'
import { Logo } from './ui'

const RECURSOS = [
  { icone: MessageCircle, titulo: 'Nota fiscal pelo WhatsApp', texto: 'Mande "nota 150 para Maria, corte de cabelo" e receba o link da nota na mesma conversa.' },
  { icone: FileText, titulo: 'Emissão em segundos', texto: 'Clientes salvos, descrição padrão e numeração automática. Compartilhe a nota por link.' },
  { icone: BarChart3, titulo: 'Financeiro sem planilha', texto: 'Entradas e saídas organizadas por categoria, com gráficos do mês e do ano.' },
  { icone: Gauge, titulo: 'Limite de R$ 81 mil sob controle', texto: 'Acompanhe quanto já faturou e receba o alerta antes de estourar o teto do MEI.' },
  { icone: CalendarCheck, titulo: 'DAS em dia', texto: 'Valor do mês, vencimento e histórico de pagamentos. Nada de multa por esquecimento.' },
  { icone: Landmark, titulo: 'Declaração anual entregue', texto: 'Os valores da DASN-SIMEI saem prontos do sistema e nosso contador faz a entrega para você.' },
]
const PASSOS = [
  ['Crie sua conta', 'Leva dois minutos: e-mail, senha e os dados do seu CNPJ.'],
  ['Conecte o WhatsApp', 'Um código liga o seu número à conta. Depois é só conversar.'],
  ['Deixe no automático', 'Notas, entradas e gastos alimentam o painel e a declaração anual.'],
]
const PERGUNTAS = [
  ['Preciso entender de contabilidade?', 'Não. O sistema fala a sua língua: você registra o que vendeu e o que gastou, e ele cuida das contas, dos prazos e dos alertas.'],
  ['Como funciona a nota pelo WhatsApp?', 'Você escreve o valor, o cliente e o serviço. O assistente confere os dados com você, emite a nota e devolve o link para enviar ao cliente.'],
  ['A declaração anual (DASN) está incluída?', 'Sim. O sistema soma seu faturamento do ano e você solicita a entrega com um toque. Nosso contador transmite e o recibo fica guardado na sua conta.'],
  ['Posso cancelar quando quiser?', 'Pode. Não há fidelidade nem multa, e seus dados continuam disponíveis para consulta.'],
]

function Conversa() {
  const Balao = ({ meu, children }: { meu?: boolean; children: React.ReactNode }) => (
    <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-snug ${meu ? 'self-end rounded-br-md bg-[#0b5c46] text-emerald-50' : 'self-start rounded-bl-md bg-[#16283a] text-[var(--tinta)]'}`}>
      {children}
      {meu && <CheckCheck size={14} className="-mb-0.5 ml-1.5 inline text-sky-300" />}
    </div>
  )
  return (
    <div className="cartao mx-auto w-full max-w-sm overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-3 border-b border-[var(--borda)] bg-[#0d2233] px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--verde)] font-bold text-[var(--verde-escuro)]">{MARCA.nome.charAt(0)}</span>
        <div>
          <p className="text-sm font-semibold">
            {MARCA.nome}
            {MARCA.destaque}
          </p>
          <p className="text-xs text-[var(--verde)]">online</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <Balao meu>nota 150 para Maria Silva, corte de cabelo</Balao>
        <Balao>{'Confira a nota:\n\n👤 Maria Silva\n🛠️ corte de cabelo\n💵 R$ 150,00\n\nPosso emitir? Responda SIM ou NÃO.'}</Balao>
        <Balao meu>sim</Balao>
        <Balao>{'✅ Nota nº 42 emitida!\nMaria Silva · R$ 150,00'}</Balao>
        <Balao meu>gastei 50 gasolina</Balao>
        <Balao>💸 Gasto de R$ 50,00 anotado em Transporte.</Balao>
      </div>
    </div>
  )
}

export default function Landing() {
  const { preco, config, sessao } = useDados()
  const dias = Number(config.dias_teste) || 14
  const cta = sessao ? '#/app/inicio' : '#/criar'
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          {!sessao && (
            <a href="#/entrar" className="btn text-[var(--tinta-2)] hover:text-[var(--tinta)]">
              Entrar
            </a>
          )}
          <a href={cta} className="btn btn-contorno">
            {sessao ? 'Abrir painel' : 'Criar conta'} <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <section className="grid items-center gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="text-center lg:text-left">
          <p className="rotulo">Tudo o que o MEI precisa, em um só lugar</p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.08] sm:text-6xl">
            Emita nota pelo WhatsApp e deixe seu MEI <span className="text-[var(--verde)]">no prumo</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--tinta-2)] lg:mx-0">Notas fiscais, controle financeiro, DAS e declaração anual resolvidos em poucos toques, com um contador de verdade por trás.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a href={cta} className="btn btn-verde w-full px-7 py-4 text-lg sm:w-auto">
              Testar grátis por {dias} dias <ArrowRight size={20} />
            </a>
            <a href="#planos" className="btn btn-neutro w-full px-6 py-4 text-base sm:w-auto">
              Ver o plano
            </a>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--tinta-3)] lg:justify-start">
            <ShieldCheck size={16} className="text-[var(--verde)]" /> Sem cartão de crédito para começar
          </p>
        </div>
        <Conversa />
      </section>

      <section className="py-12">
        <p className="rotulo text-center">Recursos</p>
        <h2 className="mt-3 text-center text-3xl font-bold sm:text-4xl">Menos burocracia, mais tempo para trabalhar</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <div key={titulo} className="cartao p-6 transition hover:border-[var(--verde)]/50">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--verde)]/10 text-[var(--verde)]">
                <Icone size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold">{titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--tinta-2)]">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12">
        <p className="rotulo text-center">Como funciona</p>
        <h2 className="mt-3 text-center text-3xl font-bold sm:text-4xl">Pronto em três passos</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {PASSOS.map(([titulo, texto], i) => (
            <li key={titulo} className="cartao p-6">
              <span className="titulo flex h-10 w-10 items-center justify-center rounded-full bg-[var(--verde)] text-lg font-bold text-[var(--verde-escuro)]">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold">{titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--tinta-2)]">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="planos" className="scroll-mt-6 py-12">
        <p className="rotulo text-center">Plano</p>
        <h2 className="mt-3 text-center text-3xl font-bold sm:text-4xl">Um preço só, tudo incluído</h2>
        <div className="cartao mx-auto mt-10 max-w-md border-[var(--verde)]/60 p-7 shadow-[0_30px_80px_-40px_rgba(61,220,132,0.6)]">
          <p className="font-semibold text-[var(--verde)]">Plano completo</p>
          <p className="titulo mt-3 text-5xl font-bold">
            {money(preco)}
            <span className="text-base font-medium text-[var(--tinta-3)]"> /mês</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {['Notas fiscais pelo app e pelo WhatsApp', 'Controle financeiro com gráficos', 'DAS mensal com alerta de vencimento', 'Declaração anual (DASN) entregue pelo contador', 'Alerta do limite de faturamento', 'Cadastro de clientes ilimitado'].map((t) => (
              <li key={t} className="flex gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-[var(--verde)]" /> {t}
              </li>
            ))}
          </ul>
          <a href={cta} className="btn btn-verde mt-7 w-full py-3.5 text-base">
            Começar teste grátis <ArrowRight size={18} />
          </a>
          <p className="mt-3 text-center text-xs text-[var(--tinta-3)]">{dias} dias grátis · cancele quando quiser</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl py-12">
        <h2 className="text-center text-3xl font-bold">Perguntas frequentes</h2>
        <div className="mt-8 space-y-3">
          {PERGUNTAS.map(([p, r]) => (
            <details key={p} className="cartao group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {p}
                <span className="text-xl text-[var(--verde)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--tinta-2)]">{r}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-8 border-t border-[var(--borda)] pt-6 text-center text-xs text-[var(--tinta-3)]">
        {MARCA.nome}
        {MARCA.destaque} · Feito para microempreendedores individuais
      </footer>
    </div>
  )
}
