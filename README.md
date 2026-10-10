# Meu Assessor Financeiro

App de gestão financeira pessoal no estilo "assessor por mensagem": você escreve
**"gastei 42,90 no ifood"** e ele lança e categoriza. Contas bancárias e cartões
de crédito são conectados pelo **Open Finance Brasil** (via [Pluggy](https://pluggy.ai)).

## O que tem

| Tela | O que faz |
|---|---|
| **Início** | Saldo das contas, receitas e gastos do mês, onde você gastou, faturas de cartão, gráfico dos últimos 6 meses |
| **Assessor** | Chat que entende português: lança gastos e receitas, responde "quanto gastei esse mês?", "gastos com mercado na semana", "saldo" |
| **Transações** | Lista com busca e filtros, troca de categoria, lançamento manual |
| **Contas e cartões** | Conectar banco (Open Finance), sincronizar, reconectar, desconectar (revoga o consentimento) |
| **Orçamentos** | Limite mensal por categoria com barra de progresso |
| **Segurança** | Verificação em 2 etapas (TOTP), histórico de atividade, sair de todos os dispositivos |

## Segurança

- **Sem senha do banco.** A conexão acontece no widget do agregador regulado/no app do banco.
  Guardamos só o identificador da conexão. O acesso é **somente leitura**: não existe
  como fazer Pix, pagamento ou transferência pelo app.
- **Chaves da Pluggy só no servidor** (segredos das Edge Functions), nunca no navegador.
- **Prova de dono da conexão:** o token de conexão é emitido com `clientUserId = id do usuário`
  e, antes de importar dados, o servidor confere esse campo na Pluggy. Isso impede que alguém
  "adote" a conexão bancária de outra pessoa.
- **Row Level Security em todas as tabelas:** cada usuário só lê e grava as próprias linhas.
  Contas e transações vindas do banco só podem ser gravadas pelo servidor. O usuário só
  pode mudar categoria e descrição delas (um gatilho bloqueia a alteração de valor e data).
- **Verificação em 2 etapas (TOTP)** de verdade: quando ativada, o **banco de dados** recusa
  qualquer leitura de sessão sem o segundo fator (`aal2`), não só a interface.
- **Senha forte** (12+ caracteres, maiúsculas, minúsculas, número e símbolo) e mensagens de
  erro genéricas no login, que não revelam se um e-mail existe.
- **Sessão em `sessionStorage`** (some ao fechar a aba), **saída automática após 10 minutos**
  sem uso e opção de sair de todos os dispositivos.
- **Trilha de auditoria** (logins, conexões, sincronizações, tentativas bloqueadas), visível na tela Segurança.
- **Cabeçalhos HTTP rígidos** (`vercel.json` / `public/_headers`): CSP, HSTS, proibição de iframe,
  `nosniff` e Permissions-Policy.
- **Modo privacidade** (ícone de olho): esconde todos os valores da tela.
- O assessor interpreta as mensagens **no seu próprio servidor**, sem mandar dados financeiros para terceiros.
  Tem limite de 30 mensagens por minuto.
- O webhook da Pluggy exige um segredo compartilhado (comparação em tempo constante) e
  não confia no conteúdo recebido: busca o item de novo na API.

## Projeto Supabase

Já criado: **meu-assessor-financeiro** (`hxvlfmaaaxfyiceqasvz`, região São Paulo), com o banco
aplicado e as 4 Edge Functions publicadas. Falta só cadastrar os segredos (passo 2 abaixo) e
ajustar as opções de autenticação (passo 1.3 e 1.4).

## Como configurar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Aplique o banco: `supabase link --project-ref SEU_REF && supabase db push`
   (ou cole `supabase/migrations/*.sql` no SQL Editor).
3. Em **Authentication → Providers → Email**: ative "Confirm email" e mínimo de 12 caracteres na senha.
   Em **Authentication → Multi-Factor**: habilite TOTP.
   Em **Authentication → Attack Protection**: ative "Leaked password protection" e CAPTCHA.
4. Em **Authentication → URL Configuration**, coloque a URL do seu site e `.../redefinir-senha`.

### 2. Pluggy (Open Finance)
1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) e pegue `CLIENT_ID` e `CLIENT_SECRET`.
2. Configure os segredos das funções:
   ```bash
   supabase secrets set PLUGGY_CLIENT_ID=... PLUGGY_CLIENT_SECRET=... \
     PLUGGY_WEBHOOK_SECRET=$(openssl rand -hex 32) \
     ALLOWED_ORIGINS=https://seu-dominio.com,http://localhost:5173
   ```
3. Publique as funções: `supabase functions deploy` (o `supabase/config.toml` desativa a
   verificação de JWT só no webhook, que usa um segredo próprio).
4. Cadastre o webhook na Pluggy apontando para
   `https://SEU_REF.supabase.co/functions/v1/pluggy-webhook`, com o cabeçalho
   `x-webhook-secret: <PLUGGY_WEBHOOK_SECRET>` e os eventos `item/*`.

Em desenvolvimento (`npm run dev`), o widget mostra os bancos de teste (sandbox) da Pluggy.

### 3. Frontend
```bash
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```
Para publicar, use Vercel ou Netlify. Os cabeçalhos de segurança já estão configurados.

## Estrutura
```
src/
  pages/auth/       login, cadastro, 2FA, redefinir senha
  pages/app/        Início, Assessor, Transações, Contas, Orçamentos, Segurança
  context/          sessão (2FA, inatividade, privacidade) e dados financeiros
supabase/
  migrations/       tabelas, RLS, auditoria
  functions/        pluggy-connect-token, pluggy-sync, pluggy-webhook, assessor
```
