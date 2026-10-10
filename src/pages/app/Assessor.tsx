import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Lock, SendHorizontal } from 'lucide-react'
import { supabase, callFunction } from '../../lib/supabase'
import { formatTime } from '../../lib/format'
import { useFinance } from '../../context/FinanceContext'
import type { AssessorMessage } from '../../lib/types'

const SUGGESTIONS = ['gastei 35 no almoço', 'paguei 120 de luz', 'recebi 3.500 de salário', 'quanto gastei esse mês?', 'saldo']

export default function Assessor() {
  const { reload } = useFinance()
  const [messages, setMessages] = useState<AssessorMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('assessor_messages')
      .select('id, role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setMessages((data ?? []).reverse()))
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send(content: string) {
    const msg = content.trim()
    if (!msg || sending) return
    setText('')
    setSending(true)
    const temp: AssessorMessage = { id: `tmp-${Date.now()}`, role: 'user', content: msg, created_at: new Date().toISOString() }
    setMessages((m) => [...m, temp])
    try {
      const { reply, transactionId } = await callFunction<{ reply: AssessorMessage; transactionId: string | null }>('assessor', { message: msg })
      setMessages((m) => [...m, reply])
      if (transactionId) reload()
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Não consegui responder agora.'}`, created_at: new Date().toISOString() },
      ])
    } finally {
      setSending(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(text)
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] top-[61px] z-10 flex flex-col md:static md:h-[calc(100dvh-7.5rem)] md:overflow-hidden md:rounded-3xl md:border md:border-slate-200 md:shadow-sm">
      <div className="flex items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-lg font-bold">A</span>
        <div className="flex-1">
          <p className="font-semibold leading-tight">Seu Assessor</p>
          <p className="text-xs text-emerald-100">{sending ? 'digitando…' : 'online'}</p>
        </div>
        <Lock className="h-4 w-4 text-emerald-200" aria-label="Conversa protegida" />
      </div>

      <div ref={listRef} className="chat-wallpaper flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-6">
        <p className="mx-auto w-fit rounded-lg bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-800 shadow-sm">
          🔒 Suas mensagens ficam só na sua conta e são processadas no nosso servidor.
        </p>
        {messages.length === 0 && (
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm">
            Olá! 👋 Sou seu assessor financeiro. Me conte seus gastos e receitas como se estivesse mandando mensagem para um amigo — eu organizo tudo.
            <br /><br />Experimente: <em>"gastei 42,90 no ifood"</em>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm shadow-sm md:max-w-[70%] ${
                m.role === 'user' ? 'rounded-tr-sm bg-[#d9fdd3] text-slate-900' : 'rounded-tl-sm bg-white text-slate-800'
              }`}
            >
              {m.content}
              <span className="ml-3 mt-1 block text-right text-[10px] text-slate-400">{formatTime(m.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 bg-slate-100 px-3 py-2">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-50">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Mensagem"
            aria-label="Mensagem para o assessor"
            className="flex-1 rounded-full border-0 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            aria-label="Enviar"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
