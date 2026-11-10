import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Link2, Send, Unlink } from 'lucide-react'
import { useDados } from './dados'
import { api, digitos, supabase } from './lib'
import { Botao, Cabecalho, tentar } from './ui'

type Msg = { id: number | string; direcao: 'in' | 'out'; texto: string }
const SUGESTOES = ['ajuda', 'nota 150 para Maria Silva, corte de cabelo', 'gastei 50 gasolina', 'recebi 200 pix do João', 'resumo', 'das']

/** Mostra *negrito* e links como o WhatsApp. */
function Texto({ t }: { t: string }) {
  return (
    <>
      {t.split(/(\*[^*\n]+\*|https?:\/\/\S+)/g).map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <b key={i}>{p.slice(1, -1)}</b>
        ) : /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all underline">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </>
  )
}

export default function Whats() {
  const { perfil, config, recarregar } = useDados()
  const p = perfil!
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [codigo, setCodigo] = useState(p.whatsapp_codigo ?? '')
  const [ocupado, setOcupado] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const bot = digitos(config.whatsapp_bot)

  useEffect(() => {
    supabase
      .from('mei_whatsapp_msgs')
      .select('id,direcao,texto')
      .order('id', { ascending: false })
      .limit(40)
      .then(({ data }) => setMsgs((m) => (m.length ? m : ((data ?? []) as Msg[]).reverse())))
  }, [])
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' })
  }, [msgs, enviando])

  const enviar = async (t: string) => {
    t = t.trim()
    if (!t || enviando) return
    setTexto('')
    setMsgs((m) => [...m, { id: `l${Date.now()}`, direcao: 'in', texto: t }])
    setEnviando(true)
    await tentar(async () => {
      const { resposta } = await api<{ resposta: string }>('bot', { texto: t })
      setMsgs((m) => [...m, { id: `r${Date.now()}`, direcao: 'out', texto: resposta }])
    })
    setEnviando(false)
    recarregar()
  }
  const acao = async (nome: string, depois: (r: { codigo?: string }) => void) => {
    setOcupado(true)
    await tentar(async () => {
      depois(await api(nome))
      await recarregar()
    })
    setOcupado(false)
  }

  return (
    <div>
      <Cabecalho titulo="WhatsApp" sub="Emita notas e registre entradas e gastos só mandando mensagem." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="cartao h-fit p-5 sm:p-6">
          {p.whatsapp ? (
            <>
              <p className="flex items-center gap-2 font-bold text-[var(--verde)]">
                <CheckCircle2 size={20} /> WhatsApp conectado
              </p>
              <p className="num mt-2 text-sm text-[var(--tinta-2)]">
                Número +{p.whatsapp.slice(0, 4)} ••••• {p.whatsapp.slice(-4)}
              </p>
              {bot && (
                <a className="btn btn-verde mt-4" href={`https://wa.me/${bot}`} target="_blank" rel="noreferrer">
                  Abrir conversa
                </a>
              )}
              <Botao className="btn-neutro ml-2 mt-4" ocupado={ocupado} onClick={() => window.confirm('Desconectar este número?') && acao('whatsapp_desvincular', () => setCodigo(''))}>
                <Unlink size={16} /> Desconectar
              </Botao>
            </>
          ) : (
            <>
              <p className="rotulo">Conectar</p>
              <h2 className="mt-1 text-xl font-bold">Ligue seu número à conta</h2>
              <ol className="mt-4 space-y-3 text-sm text-[var(--tinta-2)]">
                <li>
                  <b className="text-[var(--tinta)]">1.</b> Gere seu código de conexão.
                </li>
                <li>
                  <b className="text-[var(--tinta)]">2.</b> Envie a mensagem <b className="text-[var(--tinta)]">vincular {codigo || '000000'}</b> para o nosso WhatsApp.
                </li>
                <li>
                  <b className="text-[var(--tinta)]">3.</b> Pronto: a partir daí é só conversar.
                </li>
              </ol>
              {codigo ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[var(--verde)]/60 p-4 text-center">
                  <p className="text-xs text-[var(--tinta-3)]">Seu código</p>
                  <p className="num titulo text-3xl font-bold tracking-[0.3em] text-[var(--verde)]">{codigo}</p>
                  {bot ? (
                    <a className="btn btn-verde mt-3" href={`https://wa.me/${bot}?text=${encodeURIComponent('vincular ' + codigo)}`} target="_blank" rel="noreferrer">
                      Enviar pelo WhatsApp
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-amber-200">O número de atendimento ainda está sendo ativado. Enquanto isso, use o simulador ao lado: ele funciona igual.</p>
                  )}
                </div>
              ) : (
                <Botao className="btn-verde mt-5" ocupado={ocupado} onClick={() => acao('whatsapp_codigo', (r) => setCodigo(r.codigo ?? ''))}>
                  <Link2 size={16} /> Gerar código
                </Botao>
              )}
            </>
          )}
          <div className="mt-6 border-t border-[var(--borda)] pt-5">
            <h3 className="text-sm font-bold">O que você pode pedir</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-[var(--tinta-2)]">
              <li>🧾 “nota 150 para Maria Silva, corte de cabelo”</li>
              <li>💰 “recebi 200 pix do João”</li>
              <li>💸 “gastei 50 gasolina”</li>
              <li>📊 “resumo” · 📅 “das” · 📄 “notas”</li>
            </ul>
          </div>
        </section>

        <section className="cartao flex h-[34rem] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-[var(--borda)] bg-[#0d2233] px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--verde)] font-bold text-[var(--verde-escuro)]">P</span>
            <div>
              <p className="text-sm font-semibold">Assistente</p>
              <p className="text-xs text-[var(--tinta-3)]">Simulador: as ações aqui são reais na sua conta</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
            {msgs.length === 0 && <p className="m-auto max-w-xs text-center text-sm text-[var(--tinta-3)]">Experimente mandar uma das sugestões abaixo para ver o assistente em ação.</p>}
            {msgs.map((m) => (
              <div key={m.id} className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-snug ${m.direcao === 'in' ? 'self-end rounded-br-md bg-[#0b5c46] text-emerald-50' : 'self-start rounded-bl-md bg-[#16283a]'}`}>
                <Texto t={m.texto} />
              </div>
            ))}
            {enviando && <div className="self-start rounded-2xl rounded-bl-md bg-[#16283a] px-4 py-2 text-sm text-[var(--tinta-3)]">digitando…</div>}
            <div ref={fim} />
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-[var(--borda)] px-3 py-2">
            {SUGESTOES.map((s) => (
              <button key={s} className="chip shrink-0 hover:bg-white/15" onClick={() => enviar(s)}>
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-[var(--borda)] p-3"
            onSubmit={(e) => {
              e.preventDefault()
              enviar(texto)
            }}
          >
            <input className="campo" placeholder="Escreva uma mensagem" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensagem" />
            <Botao type="submit" className="btn-verde px-4" disabled={enviando || !texto.trim()} aria-label="Enviar">
              <Send size={18} />
            </Botao>
          </form>
        </section>
      </div>
    </div>
  )
}
