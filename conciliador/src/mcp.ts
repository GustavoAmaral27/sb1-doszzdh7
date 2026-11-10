import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { accountComposition, findEntries, latestIssues, listCompanies, trialBalance } from './queries.ts'
import { dirsFrom } from './run.ts'

// Servidor MCP somente leitura: responde consultas sobre a contabilidade a partir do razão
// que a Rotina Automática do Domínio Web exporta. Uso: tsx src/mcp.ts [pasta-de-dados]
const dirs = dirsFrom(path.resolve(process.argv[2] ?? process.env.CONCILIADOR_DADOS ?? 'dados'))
const server = new McpServer({ name: 'dominio-web', version: '1.0.0' })

const cnpj = z.string().describe('CNPJ da empresa, com ou sem pontuação')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Data no formato AAAA-MM-DD')
const readOnly = { readOnlyHint: true }

/** Devolve o resultado em JSON; erro vira mensagem legível em vez de derrubar o servidor. */
const reply = async (work: () => Promise<unknown>) => {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(await work(), null, 2) }] }
  } catch (err) {
    return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true }
  }
}

server.registerTool(
  'listar_empresas',
  {
    description: 'Lista as empresas com dados do Domínio disponíveis e a data da última exportação do razão de cada uma.',
    annotations: readOnly,
  },
  () => reply(() => listCompanies(dirs)),
)

server.registerTool(
  'balancete',
  {
    description:
      'Balancete da empresa a partir do último razão exportado do Domínio: saldo anterior, débitos, créditos e saldo de cada conta (em reais; saldo positivo = devedor, negativo = credor).',
    inputSchema: { cnpj },
    annotations: readOnly,
  },
  ({ cnpj }) => reply(() => trialBalance(dirs, cnpj)),
)

server.registerTool(
  'lancamentos',
  {
    description:
      'Lançamentos contábeis do razão do Domínio. Filtra por conta (razão da conta), trecho do histórico, valor exato e período. Sem filtro de conta busca em todas.',
    inputSchema: {
      cnpj,
      conta: z.string().optional().describe('Código reduzido ou classificação da conta'),
      texto: z.string().optional().describe('Trecho do histórico (ignora acentos e maiúsculas)'),
      valor: z.number().optional().describe('Valor exato em reais, a débito ou a crédito'),
      de: date.optional(),
      ate: date.optional(),
      limite: z.number().int().optional().describe('Máximo de lançamentos devolvidos (padrão 200, até 1000)'),
    },
    annotations: readOnly,
  },
  ({ cnpj, ...filter }) => reply(() => findEntries(dirs, cnpj, filter)),
)

server.registerTool(
  'composicao_saldo',
  {
    description:
      'Composição do saldo de uma conta (fornecedor, cliente ou outra patrimonial): casa débitos com créditos e devolve os itens em aberto que formam o saldo.',
    inputSchema: { cnpj, conta: z.string().describe('Código reduzido ou classificação da conta') },
    annotations: readOnly,
  },
  ({ cnpj, conta }) => reply(() => accountComposition(dirs, cnpj, conta)),
)

server.registerTool(
  'pendencias',
  {
    description:
      'Pendências apontadas na última conciliação da empresa: movimentos sem regra, lançamentos sem extrato, divergência de saldo bancário, saldos invertidos e itens antigos em aberto.',
    inputSchema: { cnpj },
    annotations: readOnly,
  },
  ({ cnpj }) => reply(() => latestIssues(dirs, cnpj)),
)

await server.connect(new StdioServerTransport())
