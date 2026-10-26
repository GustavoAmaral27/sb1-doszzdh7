# Financeiro Z-TEC & Amaral

App financeiro (PWA, instalável no celular) para as empresas **Z-TEC Quarteirização Contábil** e **Amaral Contabilidade**.

- **Dashboard** com a soma das duas empresas (ou de uma só, pelo seletor no topo)
- **Contas a pagar** e **contas a receber**: lançamento, parcelas mensais, baixa com um toque, filtros e busca
- **Fluxo de caixa** mensal, previsto ou realizado, com gráfico e saldo dia a dia
- **Ajustes**: saldo inicial por empresa, backup/restauração em JSON

Publicado como Artifact no claude.ai, os dados ficam salvos na nuvem (banco do Artifact, visível só para o dono e editores). Em outra hospedagem, ficam no próprio aparelho (localStorage). Use o backup em Ajustes.

## Rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/ para publicar
npm run build:artifact  # gera dist-artifact/financeiro.html (arquivo único para o claude.ai)
```

## Publicar (funciona sem internet)

O repositório já tem `netlify.toml`. No Netlify: **Add new site → Import an existing project → GitHub**,
escolha este repositório e o branch `app-financeiro`. O build (`npm run build`) e a pasta `dist` já vêm configurados.

Abra o link no celular uma vez com internet e adicione à tela inicial. A partir daí o app abre e salva
lançamentos sem internet. O `scripts/gen-sw.mjs` gera o service worker que guarda o app no aparelho.
