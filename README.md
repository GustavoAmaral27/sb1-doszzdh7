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

## PrumoMEI (sistema para o MEI assinar)

Segunda página do mesmo projeto, publicada em `/mei/`:
**https://gustavoamaral27.github.io/sb1-doszzdh7/mei/**

- **Página de vendas**, cadastro com teste grátis, login e recuperação de senha
- **Início**: entradas, saídas, resultado, limite anual de R$ 81 mil, gráfico do ano e próximas obrigações
- **Notas fiscais** (NFS-e): emissão, consulta, cancelamento e link público para o cliente
- **Financeiro**: entradas e saídas por categoria
- **Impostos**: DAS mês a mês e pedido de entrega da declaração anual (DASN-SIMEI)
- **WhatsApp**: robô que emite nota, registra entradas e gastos e responde resumo e DAS; tem simulador dentro do app
- **Minha conta**: dados da empresa e assinatura
- **Área do contador** (só administradores): assinantes, declarações a entregar e configurações (preço, dias de teste, salário mínimo)

### Onde fica cada parte

| Parte | Local |
|---|---|
| Telas | `src/mei/` (o nome do produto é `MARCA`, em `src/mei/lib.ts`) |
| Banco (tabelas `mei_*`, com RLS) | `supabase/migrations/` |
| Servidor (função `mei-api`) | `supabase/functions/mei-api/` |

### Integrações (segredos da função `mei-api` no Supabase)

Sem as chaves, o sistema funciona em modo de demonstração: as notas saem marcadas como
"sem valor fiscal", o robô só responde no simulador e o botão Assinar orienta a falar com o contador.

| Integração | Segredos | Endereço para cadastrar no provedor |
|---|---|---|
| WhatsApp (Meta Cloud API) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | `.../functions/v1/mei-api/whatsapp` |
| Pagamento (Asaas) | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_URL` (opcional, sandbox) | `.../functions/v1/mei-api/asaas` |
| NFS-e (Focus NFe, rascunho a validar em homologação) | `FOCUS_NFE_TOKEN`, `FOCUS_NFE_AMBIENTE` | — |
| Endereço do app nos links | `APP_URL` | — |

O administrador é quem tem o e-mail na tabela `mei_admins`.
