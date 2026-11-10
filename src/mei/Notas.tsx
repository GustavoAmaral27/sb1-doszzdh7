import { useEffect, useMemo, useState } from 'react'
import { Ban, Copy, ExternalLink, FileText, Loader2, MessageCircle, Plus, Printer, Search } from 'lucide-react'
import { fmtDate, money, parseMoney, todayISO } from '../lib/utils'
import { useDados } from './dados'
import { api, digitos, fmtDoc, notaPublica, supabase, urlApp, type Nota, type Perfil } from './lib'
import { Botao, Cabecalho, Campo, Logo, Modal, Tile, Vazio, avisar, tentar } from './ui'

const STATUS: Record<Nota['status'], [string, string]> = {
  emitida: ['Emitida', 'chip-bom'],
  processando: ['Processando', 'chip-alerta'],
  cancelada: ['Cancelada', 'chip-critico'],
  erro: ['Rejeitada', 'chip-critico'],
}

export function FormNota({ onClose, aoEmitir }: { onClose: () => void; aoEmitir?: (n: Nota) => void }) {
  const { perfil, clientes, recarregar } = useDados()
  const [f, setF] = useState({ tomador_nome: '', tomador_documento: '', tomador_email: '', descricao: perfil!.descricao_servico, valor: '' })
  const [salvarCliente, setSalvarCliente] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const conhecido = clientes.find((c) => c.nome.toLowerCase() === f.tomador_nome.trim().toLowerCase())

  const escolher = (nome: string) => {
    const c = clientes.find((x) => x.nome.toLowerCase() === nome.trim().toLowerCase())
    setF((a) => ({ ...a, tomador_nome: nome, ...(c ? { tomador_documento: fmtDoc(c.documento), tomador_email: c.email } : {}) }))
  }
  const emitir = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseMoney(f.valor)
    if (!(valor > 0)) return avisar('Informe o valor da nota.', true)
    setOcupado(true)
    await tentar(async () => {
      const { nota } = await api<{ nota: Nota }>('emitir_nota', { nota: { ...f, valor } })
      if (salvarCliente && !conhecido && f.tomador_nome.trim()) {
        await supabase.from('mei_clientes').insert({ nome: f.tomador_nome.trim(), documento: digitos(f.tomador_documento), email: f.tomador_email.trim() })
      }
      await recarregar()
      if (nota.status === 'erro') throw new Error(`A nota foi rejeitada: ${nota.erro}`)
      avisar(nota.status === 'emitida' ? `Nota nº ${nota.numero} emitida.` : `Nota nº ${nota.numero} enviada para autorização.`)
      onClose()
      aoEmitir?.({ ...nota, valor: Number(nota.valor) })
    })
    setOcupado(false)
  }

  return (
    <Modal titulo="Emitir nota fiscal" onClose={onClose}>
      <form onSubmit={emitir} className="space-y-4">
        <Campo rotulo="Cliente (quem vai receber a nota)" dica="Deixe em branco para consumidor não identificado.">
          <input className="campo" list="lista-clientes" autoFocus placeholder="Nome ou razão social" value={f.tomador_nome} onChange={(e) => escolher(e.target.value)} />
          <datalist id="lista-clientes">
            {clientes.map((c) => (
              <option key={c.id} value={c.nome} />
            ))}
          </datalist>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="CPF ou CNPJ (opcional)">
            <input className="campo" inputMode="numeric" value={f.tomador_documento} onChange={(e) => setF({ ...f, tomador_documento: e.target.value })} onBlur={() => setF({ ...f, tomador_documento: fmtDoc(f.tomador_documento) })} />
          </Campo>
          <Campo rotulo="E-mail (opcional)">
            <input className="campo" type="email" value={f.tomador_email} onChange={(e) => setF({ ...f, tomador_email: e.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Serviço prestado">
          <textarea className="campo min-h-[5rem]" required placeholder="Descreva o serviço" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </Campo>
        <Campo rotulo="Valor (R$)">
          <input className="campo num text-xl font-semibold" inputMode="decimal" required placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </Campo>
        {!conhecido && f.tomador_nome.trim() && (
          <label className="flex items-center gap-2.5 text-sm text-[var(--tinta-2)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--verde)]" checked={salvarCliente} onChange={(e) => setSalvarCliente(e.target.checked)} />
            Salvar este cliente para as próximas notas
          </label>
        )}
        <Botao type="submit" ocupado={ocupado} className="btn-verde w-full py-3 text-base">
          Emitir nota
        </Botao>
      </form>
    </Modal>
  )
}

/** Documento da nota, em "papel" claro para leitura e impressão. */
export function Espelho({ nota, prestador }: { nota: Nota; prestador: Pick<Perfil, 'razao_social' | 'cnpj' | 'municipio' | 'uf'> | null }) {
  const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <div className="border-t border-slate-200 py-4">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{titulo}</p>
      {children}
    </div>
  )
  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-6 text-slate-900 sm:p-8">
      {nota.ambiente === 'simulacao' && <div className="-mx-8 -mt-8 mb-6 bg-amber-100 px-8 py-2 text-center text-xs font-bold uppercase tracking-widest text-amber-900">Documento de teste · sem valor fiscal</div>}
      {nota.status === 'cancelada' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black uppercase tracking-widest text-red-500/20 [transform:rotate(-20deg)]">Cancelada</div>}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">NFS-e · Nota Fiscal de Serviço eletrônica</p>
          <p className="mt-1 text-3xl font-extrabold">Nº {String(nota.numero).padStart(6, '0')}</p>
        </div>
        <div className="text-right text-sm">
          <p>
            Emissão: <b>{fmtDate(nota.data_emissao)}</b>
          </p>
          {nota.codigo_verificacao && (
            <p>
              Código: <b className="font-mono">{nota.codigo_verificacao}</b>
            </p>
          )}
        </div>
      </div>
      <Bloco titulo="Prestador de serviços">
        <p className="font-semibold">{prestador?.razao_social || '—'}</p>
        <p className="text-sm text-slate-600">
          CNPJ {fmtDoc(prestador?.cnpj ?? '')}
          {prestador?.municipio && ` · ${prestador.municipio}/${prestador.uf}`} · MEI (Simples Nacional)
        </p>
      </Bloco>
      <Bloco titulo="Tomador de serviços">
        <p className="font-semibold">{nota.tomador_nome}</p>
        {nota.tomador_documento && <p className="text-sm text-slate-600">{digitos(nota.tomador_documento).length === 11 ? 'CPF' : 'CNPJ'} {fmtDoc(nota.tomador_documento)}</p>}
      </Bloco>
      <Bloco titulo="Discriminação dos serviços">
        <p className="whitespace-pre-line text-sm">{nota.descricao}</p>
      </Bloco>
      <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3">
        <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">Valor total</span>
        <span className="text-2xl font-extrabold">{money(nota.valor)}</span>
      </div>
    </div>
  )
}

function VerNota({ nota, onClose }: { nota: Nota; onClose: () => void }) {
  const { perfil, recarregar } = useDados()
  const [ocupado, setOcupado] = useState(false)
  const link = `${urlApp()}#/n/${nota.token}`
  const cancelar = async () => {
    if (!window.confirm(`Cancelar a nota nº ${nota.numero}? A entrada correspondente sai do financeiro.`)) return
    setOcupado(true)
    const ok = await tentar(async () => {
      await api('cancelar_nota', { id: nota.id })
      await recarregar()
    }, 'Nota cancelada.')
    setOcupado(false)
    if (ok) onClose()
  }
  return (
    <Modal titulo={`Nota nº ${nota.numero}`} onClose={onClose} largo>
      {nota.status === 'erro' && <p className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">Rejeitada: {nota.erro}</p>}
      <Espelho nota={nota} prestador={perfil} />
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="btn btn-neutro" href={nota.pdf_url || link} target="_blank" rel="noreferrer">
          <Printer size={16} /> {nota.pdf_url ? 'Abrir PDF' : 'Imprimir / PDF'}
        </a>
        <Botao className="btn-neutro" onClick={() => navigator.clipboard.writeText(link).then(() => avisar('Link copiado.'))}>
          <Copy size={16} /> Copiar link
        </Botao>
        <a className="btn btn-neutro" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Olá! Segue a nota fiscal nº ${nota.numero} (${money(nota.valor)}): ${link}`)}`}>
          <MessageCircle size={16} /> Enviar
        </a>
        {nota.status === 'emitida' && (
          <Botao className="btn-perigo ml-auto" ocupado={ocupado} onClick={cancelar}>
            <Ban size={16} /> Cancelar nota
          </Botao>
        )}
      </div>
    </Modal>
  )
}

export function NotaPublica({ token }: { token: string }) {
  const [r, setR] = useState<Awaited<ReturnType<typeof notaPublica>> | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    notaPublica(token).then(setR, (e) => setErro(e.message))
  }, [token])
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="nao-imprimir mb-6 flex items-center justify-between">
        <a href="#/">
          <Logo />
        </a>
        {r && (
          <div className="flex gap-2">
            {r.nota.pdf_url && (
              <a className="btn btn-neutro" href={r.nota.pdf_url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> PDF oficial
              </a>
            )}
            <Botao className="btn-verde" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </Botao>
          </div>
        )}
      </div>
      {erro ? <p className="cartao p-8 text-center text-[var(--tinta-2)]">{erro}</p> : r ? <Espelho {...r} /> : <Loader2 className="mx-auto mt-20 animate-spin text-[var(--verde)]" size={32} />}
    </div>
  )
}

export default function Notas() {
  const { notas, recarregar } = useDados()
  const [busca, setBusca] = useState('')
  const [nova, setNova] = useState(false)
  const [aberta, setAberta] = useState<Nota | null>(null)
  const mes = todayISO().slice(0, 7)

  // Notas aguardando o provedor: consulta de novo ao abrir a tela.
  const pendentes = notas.some((n) => n.status === 'processando')
  useEffect(() => {
    if (pendentes) api('atualizar_notas').then(recarregar, () => {})
  }, [pendentes, recarregar])

  const validas = notas.filter((n) => n.status === 'emitida')
  const doMes = validas.filter((n) => n.data_emissao.startsWith(mes))
  const doAno = validas.filter((n) => n.data_emissao.startsWith(mes.slice(0, 4)))
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? notas.filter((n) => `${n.numero} ${n.tomador_nome} ${n.descricao} ${n.tomador_documento}`.toLowerCase().includes(q)) : notas
  }, [notas, busca])
  const soma = (l: Nota[]) => l.reduce((s, n) => s + n.valor, 0)

  return (
    <div>
      <Cabecalho titulo="Notas fiscais" sub="Emita, consulte e compartilhe suas notas de serviço.">
        <Botao className="btn-verde" onClick={() => setNova(true)}>
          <Plus size={16} /> Emitir nota
        </Botao>
      </Cabecalho>
      {notas.length === 0 ? (
        <Vazio icone={<FileText size={26} />} titulo="Nenhuma nota ainda" texto="Emita a primeira agora ou mande uma mensagem pelo WhatsApp: “nota 150 para Maria, corte de cabelo”.">
          <Botao className="btn-verde" onClick={() => setNova(true)}>
            Emitir primeira nota
          </Botao>
        </Vazio>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile rotulo="Emitidas neste mês" valor={String(doMes.length)} detalhe={money(soma(doMes))} />
            <Tile rotulo="Emitidas no ano" valor={String(doAno.length)} detalhe={money(soma(doAno))} />
            <Tile rotulo="Valor médio" valor={money(doAno.length ? soma(doAno) / doAno.length : 0)} detalhe="por nota, no ano" />
          </div>
          <div className="relative mt-5">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tinta-3)]" />
            <input className="campo pl-10" placeholder="Buscar por cliente, número ou serviço" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar notas" />
          </div>
          <ul className="cartao mt-3 divide-y divide-[var(--borda)] px-4">
            {lista.length === 0 && <li className="py-6 text-center text-sm text-[var(--tinta-3)]">Nenhuma nota encontrada.</li>}
            {lista.map((n) => (
              <li key={n.id}>
                <button className="flex w-full items-center gap-3 py-3.5 text-left" onClick={() => setAberta(n)}>
                  <span className="num flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-[var(--tinta-2)]">{n.numero}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{n.tomador_nome}</span>
                    <span className="block truncate text-xs text-[var(--tinta-3)]">
                      {fmtDate(n.data_emissao)} · {n.descricao}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-sm font-semibold">{money(n.valor)}</span>
                    <span className={`chip ${STATUS[n.status][1]} mt-0.5`}>{STATUS[n.status][0]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {nova && <FormNota onClose={() => setNova(false)} aoEmitir={setAberta} />}
      {aberta && <VerNota nota={notas.find((n) => n.id === aberta.id) ?? aberta} onClose={() => setAberta(null)} />}
    </div>
  )
}
