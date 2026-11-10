import { useState } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useDados } from './dados'
import { ATIVIDADES, UFS, digitos, fmtDoc, supabase, urlApp, type Atividade } from './lib'
import { Botao, Campo, Logo, avisar, tentar } from './ui'

const ERROS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'User already registered': 'Já existe uma conta com este e-mail. Tente entrar.',
}
const traduz = (m: string) => ERROS[m] ?? (/rate limit|security purposes/i.test(m) ? 'Muitas tentativas. Aguarde um minuto e tente de novo.' : /password/i.test(m) ? 'A senha precisa ter pelo menos 6 caracteres.' : m)

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <a href="#/" className="mb-8 self-center">
        <Logo className="text-3xl" />
      </a>
      <div className="cartao p-6 sm:p-8">{children}</div>
    </div>
  )
}

export function Entrar({ criar }: { criar: boolean }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState<'' | 'confirmar' | 'recuperar'>('')
  const [esqueci, setEsqueci] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    await tentar(async () => {
      if (esqueci) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlApp() })
        if (error) throw new Error(traduz(error.message))
        setEnviado('recuperar')
      } else if (criar) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha, options: { emailRedirectTo: urlApp() } })
        if (error) throw new Error(traduz(error.message))
        if (!data.session) setEnviado('confirmar')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (error) throw new Error(traduz(error.message))
      }
    })
    setOcupado(false)
  }

  if (enviado)
    return (
      <Moldura>
        <MailCheck className="text-[var(--verde)]" size={40} />
        <h1 className="mt-4 text-2xl font-bold">Confira seu e-mail</h1>
        <p className="mt-2 text-[var(--tinta-2)]">
          Enviamos um link para <b className="text-[var(--tinta)]">{email}</b>. {enviado === 'confirmar' ? 'Clique nele para ativar sua conta e começar o teste grátis.' : 'Clique nele para criar uma nova senha.'}
        </p>
        <a href="#/entrar" className="btn btn-neutro mt-6 w-full" onClick={() => (setEnviado(''), setEsqueci(false))}>
          Voltar para a entrada
        </a>
      </Moldura>
    )

  return (
    <Moldura>
      {esqueci && (
        <button className="mb-3 flex items-center gap-1 text-sm text-[var(--tinta-2)]" onClick={() => setEsqueci(false)}>
          <ArrowLeft size={15} /> Voltar
        </button>
      )}
      <h1 className="text-2xl font-bold">{esqueci ? 'Recuperar senha' : criar ? 'Crie sua conta' : 'Entrar'}</h1>
      <p className="mt-1 text-sm text-[var(--tinta-2)]">{esqueci ? 'Informe seu e-mail e enviaremos um link.' : criar ? 'Teste grátis, sem cartão de crédito.' : 'Bom te ver de novo.'}</p>
      <form onSubmit={enviar} className="mt-6 space-y-4">
        <Campo rotulo="E-mail">
          <input className="campo" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        {!esqueci && (
          <Campo rotulo="Senha" dica={criar ? 'Mínimo de 6 caracteres.' : undefined}>
            <input className="campo" type="password" required minLength={6} autoComplete={criar ? 'new-password' : 'current-password'} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
        )}
        <Botao type="submit" ocupado={ocupado} className="btn-verde w-full py-3 text-base">
          {esqueci ? 'Enviar link' : criar ? 'Criar conta grátis' : 'Entrar'}
        </Botao>
      </form>
      {!esqueci && (
        <div className="mt-5 space-y-2 text-center text-sm text-[var(--tinta-2)]">
          {!criar && (
            <button className="underline underline-offset-2" onClick={() => setEsqueci(true)}>
              Esqueci minha senha
            </button>
          )}
          <p>
            {criar ? 'Já tem conta? ' : 'Ainda não tem conta? '}
            <a href={criar ? '#/entrar' : '#/criar'} className="font-semibold text-[var(--verde)]">
              {criar ? 'Entrar' : 'Criar conta grátis'}
            </a>
          </p>
        </div>
      )}
    </Moldura>
  )
}

export function NovaSenha() {
  const { fimRecuperacao } = useDados()
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  return (
    <Moldura>
      <h1 className="text-2xl font-bold">Nova senha</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setOcupado(true)
          const ok = await tentar(async () => {
            const { error } = await supabase.auth.updateUser({ password: senha })
            if (error) throw new Error(traduz(error.message))
          }, 'Senha alterada.')
          setOcupado(false)
          if (ok) fimRecuperacao()
        }}
      >
        <Campo rotulo="Digite a nova senha">
          <input className="campo" type="password" required minLength={6} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Botao type="submit" ocupado={ocupado} className="btn-verde w-full py-3">
          Salvar senha
        </Botao>
      </form>
    </Moldura>
  )
}

/** Valida os dígitos verificadores do CNPJ. */
export function cnpjValido(s: string) {
  const d = digitos(s)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const dv = (n: number) => {
    let soma = 0
    for (let i = 0, peso = n - 7; i < n; i++, peso = peso === 2 ? 9 : peso - 1) soma += Number(d[i]) * peso
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13])
}

/** Formulário dos dados da empresa: usado no primeiro acesso e em Minha conta. */
export function FormEmpresa({ rotuloBotao, aoSalvar }: { rotuloBotao: string; aoSalvar?: () => void }) {
  const { perfil, recarregar } = useDados()
  const p = perfil!
  const [f, setF] = useState({
    nome: p.nome,
    razao_social: p.razao_social,
    cnpj: fmtDoc(p.cnpj),
    atividade: p.atividade,
    municipio: p.municipio,
    uf: p.uf,
    descricao_servico: p.descricao_servico,
    tem_empregado: p.tem_empregado,
  })
  const [ocupado, setOcupado] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!cnpjValido(f.cnpj)) return avisar('CNPJ inválido. Confira os números.', true)
        setOcupado(true)
        const ok = await tentar(async () => {
          const { error } = await supabase
            .from('mei_perfis')
            .update({ ...f, nome: f.nome.trim(), razao_social: f.razao_social.trim(), cnpj: digitos(f.cnpj), municipio: f.municipio.trim(), onboarded: true })
            .eq('user_id', p.user_id)
          if (error) throw new Error('Não foi possível salvar. Tente de novo.')
          await recarregar()
        }, 'Dados salvos.')
        setOcupado(false)
        if (ok) aoSalvar?.()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Seu nome">
          <input className="campo" required value={f.nome} onChange={set('nome')} autoComplete="name" />
        </Campo>
        <Campo rotulo="CNPJ">
          <input className="campo" required inputMode="numeric" placeholder="00.000.000/0001-00" value={f.cnpj} onChange={set('cnpj')} onBlur={() => setF({ ...f, cnpj: fmtDoc(f.cnpj) })} />
        </Campo>
        <Campo rotulo="Nome da empresa (razão social)" className="sm:col-span-2">
          <input className="campo" required value={f.razao_social} onChange={set('razao_social')} />
        </Campo>
        <Campo rotulo="Atividade">
          <select className="campo" value={f.atividade} onChange={(e) => setF({ ...f, atividade: e.target.value as Atividade })}>
            {Object.entries(ATIVIDADES).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <Campo rotulo="Cidade">
            <input className="campo" required value={f.municipio} onChange={set('municipio')} />
          </Campo>
          <Campo rotulo="UF">
            <select className="campo" required value={f.uf} onChange={set('uf')}>
              <option value=""></option>
              {UFS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Serviço que você mais presta (opcional)" dica="Vira a descrição padrão das suas notas." className="sm:col-span-2">
          <input className="campo" placeholder="Ex.: Serviços de manutenção elétrica" value={f.descricao_servico} onChange={set('descricao_servico')} />
        </Campo>
      </div>
      <label className="flex items-center gap-2.5 text-sm text-[var(--tinta-2)]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--verde)]" checked={f.tem_empregado} onChange={(e) => setF({ ...f, tem_empregado: e.target.checked })} />
        Tenho um funcionário registrado
      </label>
      <Botao type="submit" ocupado={ocupado} className="btn-verde w-full py-3 text-base sm:w-auto sm:px-8">
        {rotuloBotao}
      </Botao>
    </form>
  )
}

export function Onboarding() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Logo className="text-3xl" />
      <p className="rotulo mt-8">Falta pouco</p>
      <h1 className="mt-2 text-3xl font-bold">Conte sobre o seu MEI</h1>
      <p className="mt-2 text-[var(--tinta-2)]">Usamos estes dados nas suas notas fiscais, no cálculo do DAS e na declaração anual.</p>
      <div className="cartao mt-6 p-5 sm:p-7">
        <FormEmpresa rotuloBotao="Começar a usar" />
      </div>
      <button className="mt-4 text-sm text-[var(--tinta-3)] underline underline-offset-2" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </div>
  )
}
