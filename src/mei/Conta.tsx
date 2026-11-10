import { useState } from 'react'
import { BadgeCheck, CreditCard, LogOut, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { fmtDate, money } from '../lib/utils'
import { useDados } from './dados'
import { FormEmpresa } from './Entrar'
import { acessoLiberado, api, diasAte, digitos, fmtDoc, ir, supabase, type Cliente } from './lib'
import { Botao, Cabecalho, Campo, Modal, Vazio, avisar, tentar } from './ui'

export function Conta() {
  const { perfil, preco, config } = useDados()
  const p = perfil!
  const [ocupado, setOcupado] = useState(false)
  const ok = acessoLiberado(p)
  const dias = diasAte(p.trial_ate)
  const estado =
    p.plano === 'ativo'
      ? { chip: 'chip-bom', nome: 'Assinatura ativa', texto: p.pago_ate ? `Próxima renovação em ${fmtDate(p.pago_ate)}.` : 'Tudo certo com o seu plano.' }
      : p.plano === 'trial' && ok
        ? { chip: 'chip-alerta', nome: 'Teste grátis', texto: `Seu teste vai até ${fmtDate(p.trial_ate)} (${dias <= 0 ? 'termina hoje' : `faltam ${dias} dia${dias > 1 ? 's' : ''}`}).` }
        : p.plano === 'atrasado'
          ? { chip: 'chip-critico', nome: 'Pagamento em atraso', texto: 'Regularize para voltar a emitir notas.' }
          : { chip: 'chip-critico', nome: p.plano === 'trial' ? 'Teste encerrado' : 'Assinatura cancelada', texto: 'Assine para continuar emitindo notas. Seus dados continuam guardados.' }
  const suporte = digitos(config.whatsapp_suporte)

  const assinar = async () => {
    setOcupado(true)
    await tentar(async () => {
      const r = await api<{ configurado: boolean; url?: string | null }>('assinar')
      if (r.configurado && r.url) window.location.href = r.url
      else if (r.configurado) avisar('Não há cobrança em aberto no momento.')
      else if (suporte) window.open(`https://wa.me/${suporte}?text=${encodeURIComponent('Olá! Quero ativar minha assinatura.')}`, '_blank')
      else avisar('O pagamento online está sendo ativado. Fale com o seu contador para liberar a assinatura.')
    })
    setOcupado(false)
  }

  return (
    <div>
      <Cabecalho titulo="Minha conta" sub={p.email} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="cartao h-fit p-5 sm:p-6">
          <p className="rotulo">Assinatura</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">Plano completo</h2>
            <span className={`chip ${estado.chip}`}>{estado.nome}</span>
          </div>
          <p className="num titulo mt-3 text-4xl font-bold">
            {money(preco)}
            <span className="text-sm font-medium text-[var(--tinta-3)]"> /mês</span>
          </p>
          <p className="mt-2 text-sm text-[var(--tinta-2)]">{estado.texto}</p>
          {p.plano === 'ativo' ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-[var(--verde)]">
              <BadgeCheck size={18} /> Obrigado por assinar!
            </p>
          ) : (
            <Botao className="btn-verde mt-5 w-full py-3 text-base" ocupado={ocupado} onClick={assinar}>
              <CreditCard size={18} /> {p.plano === 'atrasado' ? 'Pagar agora' : 'Assinar agora'}
            </Botao>
          )}
          <p className="mt-3 text-center text-xs text-[var(--tinta-3)]">Pix, boleto ou cartão · sem fidelidade</p>
          <Botao className="btn-neutro mt-6 w-full" onClick={() => supabase.auth.signOut().then(() => ir('#/'))}>
            <LogOut size={16} /> Sair da conta
          </Botao>
        </section>
        <section className="cartao p-5 sm:p-6">
          <p className="rotulo">Empresa</p>
          <h2 className="mb-5 mt-2 text-xl font-bold">Dados do seu MEI</h2>
          <FormEmpresa rotuloBotao="Salvar alterações" />
        </section>
      </div>
    </div>
  )
}

export function Clientes() {
  const { clientes, recarregar } = useDados()
  const [edit, setEdit] = useState<Partial<Cliente> | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    const doc = digitos(edit.documento ?? '')
    if (doc && doc.length !== 11 && doc.length !== 14) return avisar('CPF ou CNPJ inválido.', true)
    setOcupado(true)
    const linha = { nome: (edit.nome ?? '').trim(), documento: doc, email: (edit.email ?? '').trim(), telefone: (edit.telefone ?? '').trim() }
    const ok = await tentar(async () => {
      const { error } = edit.id ? await supabase.from('mei_clientes').update(linha).eq('id', edit.id) : await supabase.from('mei_clientes').insert(linha)
      if (error) throw new Error('Não foi possível salvar o cliente.')
      await recarregar()
    }, 'Cliente salvo.')
    setOcupado(false)
    if (ok) setEdit(null)
  }
  const apagar = async () => {
    if (!edit?.id || !window.confirm(`Apagar ${edit.nome}? As notas já emitidas não mudam.`)) return
    const ok = await tentar(async () => {
      const { error } = await supabase.from('mei_clientes').delete().eq('id', edit.id!)
      if (error) throw new Error('Não foi possível apagar.')
      await recarregar()
    }, 'Cliente apagado.')
    if (ok) setEdit(null)
  }
  const campo = (k: keyof Cliente) => ({ value: (edit?.[k] as string) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, [k]: e.target.value }) })

  return (
    <div>
      <Cabecalho titulo="Clientes" sub="Quem recebe suas notas fiscais.">
        <Botao className="btn-verde" onClick={() => setEdit({})}>
          <Plus size={16} /> Novo cliente
        </Botao>
      </Cabecalho>
      {clientes.length === 0 ? (
        <Vazio icone={<Users size={26} />} titulo="Nenhum cliente cadastrado" texto="Cadastre seus clientes para emitir notas com dois toques. Eles também são salvos quando você emite uma nota." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <button className="cartao flex w-full items-center gap-3 p-4 text-left transition hover:border-[var(--verde)]/50" onClick={() => setEdit(c)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--verde)]/10 font-bold text-[var(--verde)]">{c.nome.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.nome}</span>
                  <span className="block truncate text-xs text-[var(--tinta-3)]">{[fmtDoc(c.documento), c.email, c.telefone].filter(Boolean).join(' · ') || 'Sem documento'}</span>
                </span>
                <Pencil size={16} className="text-[var(--tinta-3)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <Modal titulo={edit.id ? 'Editar cliente' : 'Novo cliente'} onClose={() => setEdit(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <Campo rotulo="Nome ou razão social">
              <input className="campo" required autoFocus {...campo('nome')} />
            </Campo>
            <Campo rotulo="CPF ou CNPJ">
              <input className="campo" inputMode="numeric" {...campo('documento')} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="E-mail">
                <input className="campo" type="email" {...campo('email')} />
              </Campo>
              <Campo rotulo="Telefone">
                <input className="campo" inputMode="tel" {...campo('telefone')} />
              </Campo>
            </div>
            <div className="flex gap-3 pt-1">
              {edit.id && (
                <Botao type="button" className="btn-perigo" onClick={apagar}>
                  <Trash2 size={16} /> Apagar
                </Botao>
              )}
              <Botao type="submit" ocupado={ocupado} className="btn-verde flex-1 py-3">
                Salvar
              </Botao>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
