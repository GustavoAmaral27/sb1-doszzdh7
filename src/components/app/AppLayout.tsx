import { NavLink, Outlet } from 'react-router-dom'
import { ArrowLeftRight, Eye, EyeOff, LayoutDashboard, Landmark, LogOut, MessageCircle, PiggyBank, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { FinanceProvider } from '../../context/FinanceContext'
import { cn } from '../../lib/utils'
import Logo from './Logo'

const NAV = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/assessor', label: 'Assessor', icon: MessageCircle },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas e cartões', short: 'Contas', icon: Landmark },
  { to: '/orcamentos', label: 'Orçamentos', icon: PiggyBank },
  { to: '/seguranca', label: 'Segurança', icon: ShieldCheck },
]

export default function AppLayout() {
  const { session, privacy, togglePrivacy, signOut, hasMfa } = useAuth()
  const name = (session?.user.user_metadata.full_name as string | undefined)?.split(' ')[0]

  return (
    <FinanceProvider>
      <div className="min-h-screen bg-slate-50 md:flex">
        {/* Barra lateral (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-900 px-4 py-6 md:flex">
          <div className="px-2"><Logo light /></div>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:bg-white/5 hover:text-white')
                }
              >
                <Icon className="h-5 w-5" aria-hidden /> {label}
              </NavLink>
            ))}
          </nav>
          {!hasMfa && (
            <NavLink to="/seguranca" className="mb-3 rounded-xl bg-amber-400/10 p-3 text-xs text-amber-200 hover:bg-amber-400/20">
              <strong className="block text-amber-300">Ative a verificação em 2 etapas</strong>
              Proteja seus dados bancários com um código do seu celular.
            </NavLink>
          )}
          <button onClick={() => signOut()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
            <LogOut className="h-5 w-5" aria-hidden /> Sair
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur md:px-8">
            <div className="md:hidden"><Logo /></div>
            <p className="hidden text-sm text-slate-500 md:block">
              Olá{name ? `, ${name}` : ''}! 👋 Seus dados estão protegidos com criptografia.
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={togglePrivacy}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label={privacy ? 'Mostrar valores' : 'Ocultar valores'}
                title={privacy ? 'Mostrar valores' : 'Ocultar valores'}
              >
                {privacy ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
              <NavLink to="/seguranca" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Segurança">
                <ShieldCheck className="h-5 w-5" />
                {!hasMfa && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" />}
              </NavLink>
              <button onClick={() => signOut()} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Sair">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">
            <Outlet />
          </main>
        </div>

        {/* Navegação inferior (celular) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.filter((n) => n.to !== '/seguranca').map(({ to, label, short, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-emerald-600' : 'text-slate-500')}
            >
              <Icon className="h-5 w-5" aria-hidden /> {short ?? label}
            </NavLink>
          ))}
        </nav>
      </div>
    </FinanceProvider>
  )
}
