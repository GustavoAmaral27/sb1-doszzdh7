import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import { composeAccount } from '../src/accounts.ts'
import { reconcileBank } from '../src/bank.ts'
import { buildDominioTxt } from '../src/dominio.ts'
import { parseOfx } from '../src/ofx.ts'
import { csvRows, parseLedgerRows } from '../src/razao.ts'
import { dirsFrom, runAll } from '../src/run.ts'
import type { CompanyConfig, LedgerAccount } from '../src/types.ts'
import { parseDate, parseMoney } from '../src/util.ts'

const RAZAO: unknown[][] = [
  ['EMPRESA TESTE LTDA', '', '', '', '', '', ''],
  ['Conta: 8 - 1.1.1.02.001 BANCO ITAU'],
  ['Data', 'Lote', 'Histórico', 'Cta.C.Part.', 'Débito', 'Crédito', 'Saldo'],
  ['', '', 'Saldo anterior', '', '', '', '1.000,00D'],
  ['02/10/2026', '1', 'RECEBIMENTO NF 101 CLIENTE A', '20', '500,00', '', '1.500,00D'],
  ['05/10/2026', '2', 'PAGTO DUPL 77 FORNECEDOR B', '50', '', '300,00', '1.200,00D'],
  ['20/10/2026', '3', 'CHEQUE 123 NAO COMPENSADO', '50', '', '80,00', '1.120,00D'],
  ['', '', 'Total da conta', '', '500,00', '380,00', ''],
  ['Conta: 20 - 1.1.2.01.001 CLIENTES'],
  ['Data', 'Lote', 'Histórico', 'Cta.C.Part.', 'Débito', 'Crédito', 'Saldo'],
  ['01/10/2026', '4', 'VENDA NF 101 CLIENTE A', '300', '500,00', '', ''],
  ['02/10/2026', '1', 'RECEBIMENTO NF 101 CLIENTE A', '8', '', '500,00', ''],
  ['10/06/2026', '5', 'VENDA NF 90 CLIENTE C', '300', '250,00', '', ''],
  ['Conta: 50 - 2.1.1.01.001 FORNECEDORES'],
  ['Data', 'Lote', 'Histórico', 'Cta.C.Part.', 'Débito', 'Crédito', 'Saldo'],
  ['', '', 'Saldo anterior', '', '', '', '300,00C'],
  ['05/10/2026', '2', 'PAGTO DUPL 77 FORNECEDOR B', '8', '300,00', '', ''],
  ['Conta: 300 - 3.1.1.01.001 RECEITA DE VENDAS'],
  ['Data', 'Lote', 'Histórico', 'Cta.C.Part.', 'Débito', 'Crédito', 'Saldo'],
  ['01/10/2026', '4', 'VENDA NF 101 CLIENTE A', '20', '', '500,00', ''],
]

const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0341<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261031
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261002120000[-3:BRT]<TRNAMT>500.00<FITID>A1<MEMO>TED CLIENTE A</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261006<TRNAMT>-300.00<FITID>A2<MEMO>PAG BOLETO FORNECEDOR B</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261010<TRNAMT>-45.90<FITID>A3<MEMO>TARIFA PACOTE SERVICOS</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261015<TRNAMT>1234.56<FITID>A4<MEMO>PIX RECEBIDO JOAO | SILVA</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>2388.66<DTASOF>20261031</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

const CFG: CompanyConfig = {
  cnpj: '12.345.678/0001-99',
  name: 'Empresa Teste',
  transitAccount: '999',
  bankAccounts: [{ ledgerAccount: '8', bankId: '341', acctId: '123456' }],
  rules: [{ match: 'tarifa', account: '450', direction: 'saida' }],
}

const account = (ledger: LedgerAccount[], code: string) => ledger.find((a) => a.code === code)!

test('valores e datas no formato brasileiro', () => {
  assert.equal(parseMoney('1.234,56'), 123456)
  assert.equal(parseMoney('-300.00'), -30000)
  assert.equal(parseMoney('300,00C'), -30000)
  assert.equal(parseMoney('(10,5)'), -1050)
  assert.equal(parseMoney(12.3), 1230)
  assert.equal(parseMoney('1.000'), 100000)
  assert.equal(parseMoney('abc'), null)
  assert.equal(parseDate('05/10/2026'), '2026-10-05')
  assert.equal(parseDate('31/02/2026'), null)
})

test('lê o razão: contas, saldo anterior e lançamentos', () => {
  const ledger = parseLedgerRows(RAZAO)
  assert.deepEqual(ledger.map((a) => a.code), ['8', '20', '50', '300'])
  const bank = account(ledger, '8')
  assert.equal(bank.classification, '1.1.1.02.001')
  assert.equal(bank.name, 'BANCO ITAU')
  assert.equal(bank.openingBalance, 100000)
  assert.equal(bank.entries.length, 3)
  assert.equal(account(ledger, '50').openingBalance, -30000)
})

test('lê o razão em csv ANSI com ponto e vírgula', () => {
  const text = RAZAO.map((r) => r.map((c) => `"${c}"`).join(';')).join('\r\n')
  const ledger = parseLedgerRows(csvRows(Buffer.from(text, 'latin1')))
  assert.equal(account(ledger, '8').entries[0].history, 'RECEBIMENTO NF 101 CLIENTE A')
  assert.equal(account(ledger, '8').entries[1].credit, 30000)
})

test('conciliação bancária: casa, classifica por regra e manda o resto para a transitória', () => {
  const [stmt] = parseOfx(Buffer.from(OFX))
  assert.equal(stmt.txns.length, 4)
  const r = reconcileBank(stmt, account(parseLedgerRows(RAZAO), '8'), CFG, new Set())
  assert.equal(r.matched, 2) // o pagamento casa mesmo com 1 dia de diferença
  assert.deepEqual(
    r.entries.map((e) => [e.date, e.debit, e.credit, e.amount, e.classified]),
    [
      ['2026-10-10', '450', '8', 4590, true],
      ['2026-10-15', '8', '999', 123456, false],
    ],
  )
  assert.deepEqual(r.issues.map((i) => i.kind).sort(), ['contabil_sem_extrato', 'saldo_banco_diverge', 'sem_regra'])
  // A divergência de saldo é exatamente o cheque não compensado.
  assert.equal(r.issues.find((i) => i.kind === 'saldo_banco_diverge')!.amount, -8000)
})

test('movimento já enviado não é gerado de novo', () => {
  const [stmt] = parseOfx(Buffer.from(OFX))
  const ledger = account(parseLedgerRows(RAZAO), '8')
  const first = reconcileBank(stmt, ledger, CFG, new Set())
  const second = reconcileBank(stmt, ledger, CFG, new Set(first.entries.map((e) => e.key)))
  assert.equal(second.entries.length, 0)
  assert.equal(second.issues.find((i) => i.kind === 'saldo_banco_diverge')!.amount, -8000)
})

test('composição de saldo: baixa por documento e contra o saldo anterior', () => {
  const ledger = parseLedgerRows(RAZAO)
  const clients = composeAccount(account(ledger, '20'))
  assert.equal(clients.balance, 25000)
  assert.deepEqual(clients.open, [{ date: '2026-06-10', history: 'VENDA NF 90 CLIENTE C', amount: 25000 }])
  const suppliers = composeAccount(account(ledger, '50'))
  assert.equal(suppliers.balance, 0)
  assert.deepEqual(suppliers.open, [])
})

test('arquivo do Domínio: leiaute com separador, ANSI, sem pipe no histórico', () => {
  const txt = buildDominioTxt(CFG.cnpj, [
    { key: 'k', date: '2026-10-15', debit: '8', credit: '999', amount: 123456, history: 'Pix João | Silva', classified: false },
  ]).toString('latin1')
  assert.equal(txt, '|0000|12345678000199|\r\n|6000|X||||\r\n|6100|15/10/2026|8|999|1234,56||PIX JOÃO SILVA||||\r\n')
})

test('execução completa: gera TXT e relatórios, arquiva a entrada e não duplica na segunda vez', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'conciliador-'))
  const dirs = dirsFrom(base)
  const inbox = path.join(dirs.inbox, '12345678000199')
  await mkdir(inbox, { recursive: true })
  await mkdir(dirs.companies, { recursive: true })
  await writeFile(path.join(dirs.companies, '12345678000199.json'), JSON.stringify(CFG))
  const feed = async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Razão').addRows(RAZAO)
    await wb.xlsx.writeFile(path.join(inbox, 'razao.xlsx'))
    await writeFile(path.join(inbox, 'extrato.ofx'), OFX)
  }

  await feed()
  const [first] = await runAll(dirs, new Date('2026-11-10T08:00:00Z'))
  assert.equal(first.status, 'ok', first.error)
  assert.equal(first.entries, 2)
  assert.equal(first.unclassified, 1)
  const txt = (await readFile(first.txt!)).toString('latin1')
  assert.match(txt, /\|6100\|10\/10\/2026\|450\|8\|45,90\|\|TARIFA PACOTE SERVICOS\|/)
  assert.deepEqual(await readdir(inbox), [])
  const pend = await readFile(path.join(dirs.out, '12345678000199', 'pendencias_20261110_080000.csv'), 'latin1')
  assert.match(pend, /item_antigo/) // NF 90 em aberto desde junho
  assert.match(pend, /contabil_sem_extrato/)

  // O Domínio ainda não importou: o mesmo razão e o mesmo extrato voltam, nada é gerado em dobro.
  await feed()
  const [second] = await runAll(dirs, new Date('2026-11-10T09:00:00Z'))
  assert.equal(second.entries, 0)
  assert.equal(second.txt, undefined)

  // Sem razão, o extrato espera.
  await writeFile(path.join(inbox, 'extrato.ofx'), OFX)
  const [third] = await runAll(dirs, new Date('2026-11-10T10:00:00Z'))
  assert.equal(third.status, 'aguardando_razao')
  assert.deepEqual(await readdir(inbox), ['extrato.ofx'])
})
