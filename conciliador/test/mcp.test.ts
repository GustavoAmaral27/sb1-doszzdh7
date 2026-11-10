import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { dirsFrom, runAll } from '../src/run.ts'

const CNPJ = '12345678000199'
const RAZAO = [
  'Conta: 8 - 1.1.1.02.001 BANCO ITAU',
  'Data;Lote;Histórico;Cta.C.Part.;Débito;Crédito;Saldo',
  ';;Saldo anterior;;;;1.000,00D',
  '02/10/2026;1;RECEBIMENTO NF 101 CLIENTE A;20;500,00;;',
  '05/10/2026;2;PAGTO DUPL 77 FORNECEDOR B;50;;300,00;',
  'Conta: 20 - 1.1.2.01.001 CLIENTES',
  'Data;Lote;Histórico;Cta.C.Part.;Débito;Crédito;Saldo',
  '01/10/2026;4;VENDA NF 101 CLIENTE A;300;500,00;;',
  '02/10/2026;1;RECEBIMENTO NF 101 CLIENTE A;8;;500,00;',
  '10/06/2026;5;VENDA NF 90 CLIENTE C;300;250,00;;',
].join('\r\n')

test('servidor MCP: um cliente real consulta o razão exportado pelo Domínio', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'mcp-'))
  const dirs = dirsFrom(base)
  await mkdir(path.join(dirs.inbox, CNPJ), { recursive: true })
  await mkdir(dirs.companies, { recursive: true })
  await writeFile(path.join(dirs.inbox, CNPJ, 'razao.csv'), Buffer.from(RAZAO, 'latin1'))
  await writeFile(
    path.join(dirs.companies, `${CNPJ}.json`),
    JSON.stringify({ cnpj: CNPJ, name: 'Empresa Teste', transitAccount: '999', bankAccounts: [] }),
  )

  const client = new Client({ name: 'teste', version: '1' })
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/mcp.ts', base], stderr: 'inherit' }),
  )
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean }
    return { error: !!r.isError, text: r.content[0].text, data: r.isError ? null : JSON.parse(r.content[0].text) }
  }

  try {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort()
    assert.deepEqual(tools, ['balancete', 'composicao_saldo', 'lancamentos', 'listar_empresas', 'pendencias'])

    const companies = (await call('listar_empresas')).data
    assert.equal(companies[0].cnpj, CNPJ)
    assert.equal(companies[0].razao, 'razao.csv')

    const bal = (await call('balancete', { cnpj: '12.345.678/0001-99' })).data
    assert.deepEqual(bal.periodo, { de: '2026-06-10', ate: '2026-10-05' })
    assert.deepEqual(bal.contas[0], {
      conta: '8', classificacao: '1.1.1.02.001', nome: 'BANCO ITAU',
      saldo_anterior: 1000, debitos: 500, creditos: 300, saldo: 1200,
    })

    const found = (await call('lancamentos', { cnpj: CNPJ, texto: 'cliente a', de: '2026-10-02' })).data
    assert.equal(found.total, 2)
    assert.equal(found.cortado, false)
    assert.deepEqual(found.lancamentos.map((l: { conta: string }) => l.conta).sort(), ['20', '8'])
    const cut = (await call('lancamentos', { cnpj: CNPJ, limite: 2 })).data
    assert.equal(cut.total, 5)
    assert.equal(cut.cortado, true)
    assert.equal(cut.total_debitos, 1250) // o total é de tudo que casou, não só do que coube

    const comp = (await call('composicao_saldo', { cnpj: CNPJ, conta: '1.1.2.01.001' })).data
    assert.equal(comp.saldo, 250)
    assert.deepEqual(comp.em_aberto, [{ data: '2026-06-10', historico: 'VENDA NF 90 CLIENTE C', valor: 250 }])

    // Erros voltam como mensagem, sem derrubar o servidor.
    assert.match((await call('balancete', { cnpj: '00000000000000' })).text, /Nenhum razão exportado/)
    assert.match((await call('composicao_saldo', { cnpj: CNPJ, conta: '777' })).text, /não está no razão/)
    assert.match((await call('pendencias', { cnpj: CNPJ })).text, /Nenhuma conciliação rodou/)

    // Depois que o conciliador arquiva o razão, as consultas continuam funcionando.
    await runAll(dirs, new Date('2026-11-10T08:00:00Z'))
    assert.equal((await call('balancete', { cnpj: CNPJ })).data.contas.length, 2)
    const issues = (await call('pendencias', { cnpj: CNPJ })).data
    assert.equal(issues.pendencias[0].tipo, 'item_antigo')
    assert.equal(issues.pendencias[0].valor, '250,00')
  } finally {
    await client.close()
  }
})
