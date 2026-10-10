-- Meu Assessor Financeiro — esquema base
-- Princípios de segurança:
--   * RLS ativado em TODAS as tabelas; cada usuário só enxerga as próprias linhas.
--   * Credenciais bancárias NUNCA tocam este banco: a conexão é feita pelo
--     widget do agregador Open Finance (Pluggy). Guardamos apenas o item_id.
--   * Dados vindos do banco (contas, transações sincronizadas) só podem ser
--     gravados pelo servidor (service_role, nas Edge Functions). O cliente pode
--     apenas ler e editar campos inofensivos (categoria, descrição).
--   * Toda ação sensível gera registro em audit_log (somente inserção).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  monthly_income numeric(14,2) check (monthly_income >= 0),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(new.raw_user_meta_data ->> 'full_name', 120));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------- conexões
create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'pluggy',
  item_id text not null unique,          -- id do item no agregador (não é credencial)
  institution_name text not null,
  institution_logo text,
  status text not null default 'UPDATING',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.bank_connections (user_id);

-- ------------------------------------------------------------- contas
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.bank_connections (id) on delete cascade,
  external_id text unique,
  type text not null check (type in ('checking','savings','credit_card','investment','cash')),
  name text not null check (char_length(name) <= 120),
  institution_name text,
  number_masked text,                    -- ex.: "•••• 1234"; nunca o número completo
  balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2),
  available_credit numeric(14,2),
  bill_due_day smallint check (bill_due_day between 1 and 31),
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.accounts (user_id);

-- --------------------------------------------------------- categorias
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- null = padrão do sistema
  name text not null check (char_length(name) <= 60),
  kind text not null check (kind in ('expense','income')),
  icon text not null default 'circle',
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$')
);

insert into public.categories (name, kind, icon, color) values
  ('Alimentação','expense','utensils','#f97316'),
  ('Mercado','expense','shopping-cart','#eab308'),
  ('Transporte','expense','car','#3b82f6'),
  ('Moradia','expense','home','#8b5cf6'),
  ('Saúde','expense','heart-pulse','#ef4444'),
  ('Educação','expense','graduation-cap','#06b6d4'),
  ('Lazer','expense','party-popper','#ec4899'),
  ('Assinaturas','expense','repeat','#a855f7'),
  ('Compras','expense','shopping-bag','#f43f5e'),
  ('Contas','expense','receipt','#64748b'),
  ('Outros','expense','circle','#94a3b8'),
  ('Salário','income','wallet','#16a34a'),
  ('Investimentos','income','trending-up','#059669'),
  ('Outras receitas','income','plus-circle','#22c55e');

-- --------------------------------------------------------- transações
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  external_id text unique,
  description text not null check (char_length(description) <= 200),
  amount numeric(14,2) not null check (amount > 0),
  kind text not null check (kind in ('expense','income')),
  occurred_on date not null default current_date,
  source text not null default 'manual' check (source in ('manual','assessor','open_finance')),
  created_at timestamptz not null default now()
);
create index on public.transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------- orçamentos
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  unique (user_id, category_id)
);

-- ----------------------------------------------------- conversa assessor
create table public.assessor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 2000),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.assessor_messages (user_id, created_at);

-- ------------------------------------------------------------ auditoria
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_log (user_id, created_at desc);

-- ================================================================= RLS
alter table public.profiles          enable row level security;
alter table public.bank_connections  enable row level security;
alter table public.accounts          enable row level security;
alter table public.categories        enable row level security;
alter table public.transactions      enable row level security;
alter table public.budgets           enable row level security;
alter table public.assessor_messages enable row level security;
alter table public.audit_log         enable row level security;

-- Exige que a sessão tenha passado pelo segundo fator (aal2) quando o
-- usuário tem MFA cadastrado. Sem MFA cadastrado, aal1 é aceito.
create function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = auth.uid() and status = 'verified'
      );
$$;

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()) and public.mfa_ok())
  with check (id = (select auth.uid()) and public.mfa_ok());

-- Conexões e contas: leitura pelo dono; escrita apenas pelo servidor.
create policy "read own connections" on public.bank_connections
  for select to authenticated using (user_id = (select auth.uid()) and public.mfa_ok());
create policy "read own accounts" on public.accounts
  for select to authenticated using (user_id = (select auth.uid()) and public.mfa_ok());
-- Contas manuais (dinheiro em espécie) podem ser criadas pelo usuário.
create policy "manage own manual accounts" on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()) and connection_id is null and public.mfa_ok())
  with check (user_id = (select auth.uid()) and connection_id is null and public.mfa_ok());

create policy "read categories" on public.categories
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "manage own categories" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()) and public.mfa_ok())
  with check (user_id = (select auth.uid()) and public.mfa_ok());

create policy "read own transactions" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()) and public.mfa_ok());
create policy "insert own manual transactions" on public.transactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and source <> 'open_finance' and external_id is null and public.mfa_ok());
create policy "update own transactions" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid()) and public.mfa_ok())
  with check (user_id = (select auth.uid()) and public.mfa_ok());
create policy "delete own manual transactions" on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()) and source <> 'open_finance' and public.mfa_ok());

-- Em transações bancárias, o usuário só pode mudar categoria/descrição.
create function public.guard_transaction_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' and old.source = 'open_finance' and (
       new.amount <> old.amount or new.kind <> old.kind or new.occurred_on <> old.occurred_on
    or new.account_id is distinct from old.account_id or new.external_id is distinct from old.external_id
    or new.source <> old.source) then
    raise exception 'Transações sincronizadas do banco não podem ter valor, data ou conta alterados';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'user_id é imutável';
  end if;
  return new;
end $$;
create trigger guard_transaction_update before update on public.transactions
  for each row execute function public.guard_transaction_update();

create policy "own budgets" on public.budgets
  for all to authenticated
  using (user_id = (select auth.uid()) and public.mfa_ok())
  with check (user_id = (select auth.uid()) and public.mfa_ok());

create policy "read own messages" on public.assessor_messages
  for select to authenticated using (user_id = (select auth.uid()) and public.mfa_ok());
create policy "delete own messages" on public.assessor_messages
  for delete to authenticated using (user_id = (select auth.uid()) and public.mfa_ok());

-- Auditoria: o usuário lê a própria trilha; ninguém altera ou apaga pelo cliente.
create policy "read own audit" on public.audit_log
  for select to authenticated using (user_id = (select auth.uid()));

create function public.log_event(p_action text, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (user_id, action, details)
  select auth.uid(), left(p_action, 60), coalesce(p_details, '{}')
  where auth.uid() is not null;
$$;
revoke all on function public.log_event(text, jsonb) from public, anon;
grant execute on function public.log_event(text, jsonb) to authenticated;

revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;
