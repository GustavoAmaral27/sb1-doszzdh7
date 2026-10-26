# Financeiro Z-TEC & Amaral

App financeiro (PWA, instalável no celular) para as empresas **Z-TEC Quarteirização Contábil** e **Amaral Contabilidade**.

- **Dashboard** com a soma das duas empresas (ou de uma só, pelo seletor no topo)
- **Contas a pagar** e **contas a receber**: lançamento, parcelas mensais, baixa com um toque, filtros e busca
- **Fluxo de caixa** mensal, previsto ou realizado, com gráfico e saldo dia a dia
- **Ajustes**: saldo inicial por empresa, backup/restauração em JSON

Os dados ficam salvos no próprio aparelho (localStorage). Use o backup em Ajustes.

## Rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/ para publicar
```

Publique a pasta `dist/` em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages) e abra o link no celular → "Adicionar à tela inicial".
