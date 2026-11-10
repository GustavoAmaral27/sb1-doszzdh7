import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, valorDas, type Cliente, type Dasn, type Lancamento, type Nota, type Perfil } from './lib'

interface Dados {
  perfil: Perfil | null
  lancamentos: Lancamento[]
  notas: Nota[]
  clientes: Cliente[]
  /** Competências (AAAA-MM) com DAS pago. */
  dasPagos: Set<string>
  dasn: Dasn[]
  admin: boolean
}
interface Valor extends Dados {
  /** undefined enquanto a sessão ainda está sendo lida. */
  sessao: Session | null | undefined
  carregando: boolean
  erro: string
  recuperando: boolean
  fimRecuperacao: () => void
  config: Record<string, string>
  preco: number
  das: number
  recarregar: () => Promise<void>
}

const VAZIO: Dados = { perfil: null, lancamentos: [], notas: [], clientes: [], dasPagos: new Set(), dasn: [], admin: false }
const PADRAO: Record<string, string> = { preco_mensal: '49.90', salario_minimo: '1621', whatsapp_bot: '', whatsapp_suporte: '', dias_teste: '14' }
const Ctx = createContext<Valor>(null!)
export const useDados = () => useContext(Ctx)

const numeros = <T extends object>(linhas: T[] | null, ...campos: (keyof T)[]) =>
  (linhas ?? []).map((l) => {
    const c = { ...l }
    for (const k of campos) c[k] = Number(c[k]) as T[keyof T]
    return c
  })

export function DadosProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [dados, setDados] = useState<Dados>(VAZIO)
  const [config, setConfig] = useState(PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [recuperando, setRecuperando] = useState(false)
  const uid = sessao?.user.id
  const email = sessao?.user.email ?? ''

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    supabase
      .from('mei_config')
      .select()
      .then(({ data: linhas }) => linhas && setConfig({ ...PADRAO, ...Object.fromEntries(linhas.map((l) => [l.chave, l.valor])) }))
    return () => data.subscription.unsubscribe()
  }, [])

  const recarregar = useCallback(async () => {
    if (!uid) return
    try {
      const [perfil, lanc, notas, clientes, das, dasn, admin] = await Promise.all([
        supabase.from('mei_perfis').select().eq('user_id', uid).maybeSingle(),
        supabase.from('mei_lancamentos').select().order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(5000),
        supabase.from('mei_notas').select().order('numero', { ascending: false }).limit(2000),
        supabase.from('mei_clientes').select().order('nome'),
        supabase.from('mei_das').select('competencia').eq('pago', true),
        supabase.from('mei_dasn').select().eq('user_id', uid).order('ano', { ascending: false }),
        supabase.rpc('mei_is_admin'),
      ])
      const falha = perfil.error ?? lanc.error ?? notas.error ?? clientes.error ?? das.error ?? dasn.error
      if (falha) throw falha
      let p = perfil.data as Perfil | null
      if (!p) {
        const novo = await supabase.from('mei_perfis').insert({ user_id: uid, email }).select().single()
        if (novo.error) throw novo.error
        p = novo.data as Perfil
      }
      setDados({
        perfil: p,
        lancamentos: numeros(lanc.data as Lancamento[], 'valor'),
        notas: numeros(notas.data as Nota[], 'valor'),
        clientes: (clientes.data ?? []) as Cliente[],
        dasPagos: new Set((das.data ?? []).map((d) => d.competencia as string)),
        dasn: numeros(dasn.data as Dasn[], 'receita_comercio', 'receita_servico'),
        admin: admin.data === true,
      })
      setErro('')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível carregar seus dados. Verifique a conexão e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }, [uid, email])

  useEffect(() => {
    if (sessao === undefined) return
    if (!uid) {
      setDados(VAZIO)
      setCarregando(false)
      return
    }
    setCarregando(true)
    recarregar()
  }, [sessao === undefined, uid, recarregar])

  const valor = useMemo<Valor>(
    () => ({
      ...dados,
      sessao,
      carregando: carregando || sessao === undefined,
      erro,
      recuperando,
      fimRecuperacao: () => setRecuperando(false),
      config,
      preco: Number(config.preco_mensal) || 49.9,
      das: valorDas(Number(config.salario_minimo) || 1621, dados.perfil?.atividade ?? 'servico'),
      recarregar,
    }),
    [dados, sessao, carregando, erro, recuperando, config, recarregar],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
