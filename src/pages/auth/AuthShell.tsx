import type { ReactNode } from 'react'
import { Lock, MessageCircle, ShieldCheck, Landmark } from 'lucide-react'
import Logo from '../../components/app/Logo'

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <Logo light />
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl font-bold leading-tight">
            Seu dinheiro organizado <span className="text-emerald-400">numa conversa.</span>
          </h2>
          <div className="max-w-sm space-y-3">
            <div className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2 text-sm">gastei 42,90 no ifood</div>
            <div className="w-fit rounded-2xl rounded-tl-sm bg-white/10 px-4 py-2 text-sm leading-relaxed">
              ✅ Despesa registrada!<br />💸 R$ 42,90 — Ifood<br />🏷️ Alimentação · 📅 hoje
            </div>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3"><MessageCircle className="h-5 w-5 text-emerald-400" /> Lance gastos escrevendo como no WhatsApp</li>
            <li className="flex gap-3"><Landmark className="h-5 w-5 text-emerald-400" /> Contas e cartões conectados pelo Open Finance</li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Verificação em 2 etapas e acesso somente leitura</li>
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" /> Nunca pedimos nem armazenamos a senha do seu banco.
        </p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
