# Financeiro Z-TEC & Amaral

App financeiro (PWA, instalável no celular) para as empresas **Z-TEC Quarteirização Contábil** e **Amaral Contabilidade**.

- **Dashboard** com a soma das duas empresas (ou de uma só, pelo seletor no topo)
- **Contas a pagar** e **contas a receber**: lançamento, parcelas mensais, baixa com um toque, filtros e busca
- **Fluxo de caixa** mensal, previsto ou realizado, com gráfico e saldo dia a dia
- **Ajustes**: saldo inicial por empresa, backup/restauração em JSON

Os dados ficam salvos no celular (funciona sem internet) e, com login em Ajustes, sincronizam com o Supabase (tabelas `fin_lancamentos` e `fin_config`, protegidas por RLS: cada usuário só vê as próprias linhas). Em cada lançamento vale a versão alterada por último.

## Rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/ para publicar
```

## Publicar (funciona sem internet)

Publicado automaticamente no GitHub Pages a cada push no `main` (`.github/workflows/publicar.yml`):
**https://gustavoamaral27.github.io/sb1-doszzdh7/**

Alternativa: 
O repositório já tem `netlify.toml`. No Netlify: **Add new site → Import an existing project → GitHub**,
escolha este repositório e o branch `main`. O build (`npm run build`) e a pasta `dist` já vêm configurados.

Abra o link no celular uma vez com internet e adicione à tela inicial. A partir daí o app abre e salva
lançamentos sem internet. O `scripts/gen-sw.mjs` gera o service worker que guarda o app no aparelho.
