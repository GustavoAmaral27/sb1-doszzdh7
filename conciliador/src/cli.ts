import path from 'node:path'
import { dirsFrom, runAll } from './run.ts'

// Uso: tsx src/cli.ts [pasta-de-dados] [--vigiar minutos]
// Sem --vigiar roda uma vez e sai (para o Agendador de Tarefas do Windows).
const args = process.argv.slice(2)
const w = args.indexOf('--vigiar')
const minutes = w >= 0 ? Number(args[w + 1]) || 15 : 0
const base = path.resolve(args.find((a, i) => !a.startsWith('--') && (w < 0 || i !== w + 1)) ?? process.env.CONCILIADOR_DADOS ?? 'dados')
const dirs = dirsFrom(base)

async function once(): Promise<boolean> {
  const results = await runAll(dirs)
  const time = new Date().toLocaleString('pt-BR')
  if (!results.length) console.log(`[${time}] Nenhuma empresa em ${dirs.companies}`)
  for (const r of results) {
    const what =
      r.status === 'erro'
        ? `ERRO: ${r.error}`
        : r.status === 'aguardando_razao'
          ? 'sem razão novo na entrada'
          : `${r.matched} conciliados, ${r.entries} lançamentos gerados (${r.unclassified} na transitória), ${r.issues} pendências`
    console.log(`[${time}] ${r.cnpj} ${r.name}: ${what}`)
  }
  return results.every((r) => r.status !== 'erro')
}

if (minutes) {
  console.log(`Vigiando ${base} a cada ${minutes} min. Ctrl+C para parar.`)
  for (;;) {
    await once().catch((e) => console.error(e))
    await new Promise((r) => setTimeout(r, minutes * 60_000))
  }
} else {
  process.exitCode = (await once()) ? 0 : 1
}
