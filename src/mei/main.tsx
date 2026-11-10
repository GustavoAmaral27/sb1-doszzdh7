import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BarChart3, FileText, Home, Landmark, Loader2, LogOut, Menu, MessageCircle, Shield, UserRound, Users, Wallet } from 'lucide-react'
import { cn } from '../lib/utils'
import { DadosProvider, useDados } from './dados'
import { acessoLiberado, diasAte, ir, supabase } from './lib'
import { Avisos, Botao, Logo } from './ui'
import Landing from './Landing'
import { Entrar, NovaSenha, Onboarding } from './Entrar'
import Inicio from './Inicio'
import Notas, { NotaPublica } from './Notas'
import Financeiro from './Financeiro'
import Impostos from './Impostos'
import Whats from './Whats'
import { Clientes, Conta } from './Conta'
import Admin from './Admin'
import './mei.css'

function useRota() {
  const [rota, setRota] = useState(window.location.hash)
  useEffect(() => {
    const on = () => {
      setRota(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return rota
}

const Centro = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>

function Raiz() {
  const rota = useRota()
  const d = useDados()
  if (rota.startsWith('#/n/')) return <NotaPublica token={rota.slice(4)} />
  if (d.carregando)
    return (
      <Centro>
        <Loader2 className="animate-spin text-[var(--verde)]" size={32} />
      </Centro>
    )
  if (d.recuperando) return <NovaSenha />
  if (!d.sessao) return rota.startsWith('#/entrar') || rota.startsWith('#/criar') ? <Entrar criar={rota.startsWith('#/criar')} /> : <Landing />
  if (!d.perfil)
    return (
      <Centro>
        <Logo />
        <p className="max-w-sm text-[var(--tinta-2)]">{d.erro || 'Não foi possível carregar sua conta.'}</p>
        <div className="flex gap-3">
          <Botao className="btn-verde" onClick={() => d.recarregar()}>
            Tentar de novo
          </Botao>
          <Botao className="btn-neutro" onClick={() => supabase.auth.signOut()}>
            Sair
          </Botao>
        </div>
      </Centro>
    )
  if (rota === '#/site') return <Landing />
  if (!d.perfil.onboarded) return <Onboarding />
  return <Shell pagina={rota.startsWith('#/app/') ? rota.slice(6) : 'inicio'} />
}

const MENU = [
  ['inicio', 'Início', Home],
  ['notas', 'Notas fiscais', FileText],
  ['financeiro', 'Financeiro', Wallet],
  ['impostos', 'Impostos', Landmark],
  ['whatsapp', 'WhatsApp', MessageCircle],
  ['clientes', 'Clientes', Users],
  ['conta', 'Minha conta', UserRound],
] as const

function Shell({ pagina }: { pagina: string }) {
  const { perfil, admin } = useDados()
  const p = perfil!
  const itens = [...MENU, ...(admin ? ([['admin', 'Contador', Shield]] as const) : [])]
  const dias = diasAte(p.trial_ate)
  const faixa = !acessoLiberado(p)
    ? { tom: 'critico', texto: p.plano === 'trial' ? 'Seu período de teste terminou.' : 'Sua assinatura não está ativa.', acao: 'Assinar agora' }
    : p.plano === 'trial' && dias <= 5
      ? { tom: 'alerta', texto: dias <= 0 ? 'Seu teste grátis termina hoje.' : `Seu teste grátis termina em ${dias} dia${dias > 1 ? 's' : ''}.`, acao: 'Ver planos' }
      : null
  const Tela =
    { inicio: Inicio, notas: Notas, financeiro: Financeiro, impostos: Impostos, whatsapp: Whats, clientes: Clientes, conta: Conta, admin: admin ? Admin : Inicio, mais: Mais }[pagina] ?? Inicio

  return (
    <div className="lg:flex">
      <aside className="nao-imprimir sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--borda)] bg-[#07141f]/80 p-5 backdrop-blur lg:flex">
        <a href="#/app/inicio" className="px-2">
          <Logo />
        </a>
        <nav className="mt-8 flex-1 space-y-1">
          {itens.map(([id, nome, Icone]) => (
            <a
              key={id}
              href={`#/app/${id}`}
              aria-current={pagina === id ? 'page' : undefined}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', pagina === id ? 'bg-[var(--verde)]/12 text-[var(--verde)]' : 'text-[var(--tinta-2)] hover:bg-white/5 hover:text-[var(--tinta)]')}
            >
              <Icone size={18} /> {nome}
            </a>
          ))}
        </nav>
        <div className="rounded-xl border border-[var(--borda)] p-3">
          <p className="truncate text-sm font-semibold">{p.razao_social || p.nome}</p>
          <p className="truncate text-xs text-[var(--tinta-3)]">{p.email}</p>
          <button className="mt-3 flex items-center gap-2 text-xs text-[var(--tinta-2)] hover:text-[var(--tinta)]" onClick={() => supabase.auth.signOut().then(() => ir('#/'))}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="nao-imprimir sticky top-0 z-30 flex items-center justify-between border-b border-[var(--borda)] bg-[#06111c]/90 px-4 py-3 backdrop-blur lg:hidden">
          <a href="#/app/inicio">
            <Logo className="text-xl" />
          </a>
          <a href="#/app/conta" aria-label="Minha conta" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--painel-2)] text-sm font-bold text-[var(--verde)]">
            {(p.nome || p.email).charAt(0).toUpperCase()}
          </a>
        </header>
        {faixa && (
          <div className={cn('nao-imprimir flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm', faixa.tom === 'critico' ? 'bg-red-500/15 text-red-100' : 'bg-amber-400/15 text-amber-100')}>
            {faixa.texto}
            <a href="#/app/conta" className="font-semibold underline underline-offset-2">
              {faixa.acao}
            </a>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
          <Tela />
        </main>
      </div>

      <nav className="nao-imprimir fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--borda)] bg-[#07141f]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {(
          [
            ['inicio', 'Início', Home],
            ['notas', 'Notas', FileText],
            ['financeiro', 'Financeiro', BarChart3],
            ['whatsapp', 'WhatsApp', MessageCircle],
            ['mais', 'Mais', Menu],
          ] as const
        ).map(([id, nome, Icone]) => {
          const ativo = pagina === id || (id === 'mais' && ['impostos', 'clientes', 'conta', 'admin'].includes(pagina))
          return (
            <a key={id} href={`#/app/${id}`} aria-current={ativo ? 'page' : undefined} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', ativo ? 'text-[var(--verde)]' : 'text-[var(--tinta-3)]')}>
              <Icone size={21} />
              {nome}
            </a>
          )
        })}
      </nav>
    </div>
  )
}

function Mais() {
  const { admin } = useDados()
  const itens = [...MENU.slice(3).filter(([id]) => id !== 'whatsapp'), ...(admin ? ([['admin', 'Área do contador', Shield]] as const) : [])]
  return (
    <div className="space-y-3">
      <h1 className="mb-5 text-2xl font-bold">Mais</h1>
      {itens.map(([id, nome, Icone]) => (
        <a key={id} href={`#/app/${id}`} className="cartao flex items-center gap-4 p-4 font-medium">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--verde)]/10 text-[var(--verde)]">
            <Icone size={20} />
          </span>
          {nome}
        </a>
      ))}
      <button className="cartao flex w-full items-center gap-4 p-4 font-medium text-[var(--tinta-2)]" onClick={() => supabase.auth.signOut().then(() => ir('#/'))}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
          <LogOut size={20} />
        </span>
        Sair
      </button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DadosProvider>
      <Raiz />
      <Avisos />
    </DadosProvider>
  </React.StrictMode>,
)
