import { ArrowRight, BellRing, CalendarCheck, Gauge, MessageCircle, Wallet } from 'lucide-react'
import { money } from '../lib/utils'
import { MARCA } from './store'

export function Logo() {
  return (
    <span className="text-2xl font-extrabold tracking-tight">
      {MARCA.nome}
      <span className="text-[var(--verde)]">{MARCA.destaque}</span>
    </span>
  )
}

const RECURSOS = [
  { icone: Wallet, titulo: 'Receita recorrente à vista', texto: 'Some as mensalidades da carteira e veja quanto já entrou e quanto falta receber no mês.' },
  { icone: CalendarCheck, titulo: 'DAS de todos os clientes', texto: 'Valor calculado por atividade e baixa com um toque. Nada de planilha por cliente.' },
  { icone: Gauge, titulo: 'Limite de R$ 81 mil', texto: 'Lance o faturamento mensal e seja avisado antes de o cliente estourar o teto do MEI.' },
  { icone: BellRing, titulo: 'DASN sem esquecimento', texto: 'Acompanhe quem ainda não entregou a declaração anual antes do prazo de 31 de maio.' },
  { icone: MessageCircle, titulo: 'Cobrança pelo WhatsApp', texto: 'Mensagem pronta para lembrar o cliente do DAS ou da mensalidade em aberto.' },
]

const PASSOS = [
  ['Cadastre a carteira', 'Nome, CNPJ, atividade e o honorário de cada MEI.'],
  ['Acompanhe o mês', 'Marque DAS pagos, mensalidades recebidas e o faturamento.'],
  ['Aja nos alertas', 'O painel mostra quem está em atraso ou perto do limite.'],
]

export default function Landing() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <Logo />
        <a href="#/painel" className="btn-contorno inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          Entrar no painel <ArrowRight size={16} />
        </a>
      </header>

      <section className="py-10 text-center sm:py-16">
        <p className="rotulo">Gestão de MEIs para escritórios contábeis</p>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Sua carteira de MEIs <span className="text-[var(--verde)]">organizada e rendendo todo mês</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
          Controle DAS, mensalidades e faturamento de todos os clientes em um só lugar, sem aumentar a equipe.
        </p>
        <a href="#/painel" className="btn-verde mx-auto mt-8 flex w-full max-w-md items-center justify-center gap-3 px-6 py-4 text-lg">
          Começar agora <ArrowRight size={20} />
        </a>
        <p className="mt-4 text-sm text-slate-400">Sem cadastro. Os dados ficam no seu aparelho.</p>
      </section>

      <section className="cartao p-5 sm:p-8" aria-label="Prévia do painel (dados de exemplo)">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="rotulo">Painel do contador</p>
            <h2 className="mt-2 text-2xl">Visão geral</h2>
          </div>
          <span className="rounded-lg border border-[var(--borda)] px-3 py-1.5 text-xs text-slate-300">Dados de exemplo</span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ['Receita recorrente', money(1250)],
            ['MEIs ativos', '8'],
            ['DAS pendentes no mês', '3'],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-xl border border-[var(--borda)] bg-[#0f2233] p-4">
              <p className="text-sm text-slate-300">{rotulo}</p>
              <p className="mt-2 text-2xl font-bold">{valor}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-center text-3xl font-semibold">O que o painel faz por você</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <div key={titulo} className="cartao p-5">
              <Icone className="text-[var(--verde)]" size={26} />
              <h3 className="mt-3 text-lg font-semibold">{titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-center text-3xl font-semibold">Como funciona</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {PASSOS.map(([titulo, texto], i) => (
            <li key={titulo} className="cartao p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--verde)] font-bold text-[#04130b]">{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold">{titulo}</h3>
              <p className="mt-1 text-sm text-slate-300">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cartao mt-16 p-8 text-center">
        <h2 className="text-2xl font-semibold">Pronto para organizar sua carteira?</h2>
        <a href="#/painel" className="btn-verde mx-auto mt-6 inline-flex items-center gap-3 px-8 py-4">
          Abrir o painel <ArrowRight size={20} />
        </a>
      </section>

      <footer className="mt-12 text-center text-xs text-slate-500">
        {MARCA.nome}
        {MARCA.destaque} · Ferramenta de apoio; confira valores e prazos nos canais oficiais.
      </footer>
    </div>
  )
}
