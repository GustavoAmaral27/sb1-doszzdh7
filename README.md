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

Publique a pasta `dist/` em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages) e abra o link no celular → "Adicionar à tela inicial".
