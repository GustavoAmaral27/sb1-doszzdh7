-- Sistema para MEIs (tabelas com prefixo mei_, separadas do app financeiro).
-- Depois de aplicar, registre o administrador:
--   insert into public.mei_admins values ('email-do-contador');

create table public.mei_admins (email text primary key);
alter table public.mei_admins enable row level security;

create or replace function public.mei_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mei_admins a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  )
$$;
revoke all on function public.mei_is_admin() from public, anon;
grant execute on function public.mei_is_admin() to authenticated, service_role;

create table public.mei_config (chave text primary key, valor text not null);
alter table public.mei_config enable row level security;
create policy mei_config_ler on public.mei_config for select to anon, authenticated using (true);
create policy mei_config_admin on public.mei_config for all to authenticated
  using (public.mei_is_admin()) with check (public.mei_is_admin());
insert into public.mei_config values
  ('preco_mensal', '49.90'), ('salario_minimo', '1621'), ('whatsapp_bot', ''), ('whatsapp_suporte', ''), ('dias_teste', '14');

create table public.mei_perfis (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null default '',
  nome text not null default '',
  razao_social text not null default '',
  cnpj text not null default '',
  atividade text not null default 'servico' check (atividade in ('comercio', 'servico', 'ambos')),
  descricao_servico text not null default '',
  codigo_servico text not null default '',
  municipio text not null default '',
  uf text not null default '',
  codigo_municipio text not null default '',
  tem_empregado boolean not null default false,
  onboarded boolean not null default false,
  plano text not null default 'trial' check (plano in ('trial', 'ativo', 'atrasado', 'cancelado')),
  trial_ate date not null default (current_date + 14),
  pago_ate date,
  asaas_customer text,
  asaas_subscription text,
  whatsapp text not null default '',
  whatsapp_codigo text,
  criado_em timestamptz not null default now()
);
create unique index mei_perfis_whatsapp on public.mei_perfis (whatsapp) where whatsapp <> '';
alter table public.mei_perfis enable row level security;
create policy mei_perfis_ler on public.mei_perfis for select to authenticated
  using (user_id = (select auth.uid()) or public.mei_is_admin());
create policy mei_perfis_criar on public.mei_perfis for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy mei_perfis_editar on public.mei_perfis for update to authenticated
  using (user_id = (select auth.uid()) or public.mei_is_admin())
  with check (user_id = (select auth.uid()) or public.mei_is_admin());

-- O próprio usuário não pode mexer em assinatura nem no vínculo do WhatsApp:
-- isso só muda pelo servidor (função mei-api) ou por um administrador.
create or replace function public.mei_perfis_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.mei_is_admin() then
    if tg_op = 'INSERT' then
      new.plano := 'trial';
      new.trial_ate := current_date + coalesce((select valor::int from public.mei_config where chave = 'dias_teste'), 14);
      new.pago_ate := null; new.asaas_customer := null; new.asaas_subscription := null;
      new.whatsapp := ''; new.whatsapp_codigo := null;
    else
      new.plano := old.plano; new.trial_ate := old.trial_ate; new.pago_ate := old.pago_ate;
      new.asaas_customer := old.asaas_customer; new.asaas_subscription := old.asaas_subscription;
      new.whatsapp := old.whatsapp; new.whatsapp_codigo := old.whatsapp_codigo;
    end if;
  end if;
  return new;
end $$;
create trigger mei_perfis_guard before insert or update on public.mei_perfis
  for each row execute function public.mei_perfis_guard();

create table public.mei_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  documento text not null default '',
  email text not null default '',
  telefone text not null default '',
  criado_em timestamptz not null default now()
);
create index mei_clientes_user on public.mei_clientes (user_id);
alter table public.mei_clientes enable row level security;
create policy mei_clientes_dono on public.mei_clientes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.mei_notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  numero integer not null,
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  tomador_nome text not null default '',
  tomador_documento text not null default '',
  tomador_email text not null default '',
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  data_emissao date not null default current_date,
  status text not null default 'emitida' check (status in ('processando', 'emitida', 'cancelada', 'erro')),
  ambiente text not null default 'simulacao' check (ambiente in ('simulacao', 'producao')),
  codigo_verificacao text not null default '',
  provedor_ref text not null default '',
  pdf_url text not null default '',
  erro text not null default '',
  origem text not null default 'app',
  criado_em timestamptz not null default now(),
  unique (user_id, numero)
);
create unique index mei_notas_token on public.mei_notas (token);
alter table public.mei_notas enable row level security;
-- Só leitura pelo app: emitir e cancelar passam pela função mei-api.
create policy mei_notas_ler on public.mei_notas for select to authenticated
  using (user_id = (select auth.uid()));

create table public.mei_lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tipo text not null check (tipo in ('receita', 'despesa')),
  natureza text not null default 'servico' check (natureza in ('comercio', 'servico')),
  descricao text not null,
  categoria text not null default 'Outros',
  valor numeric(12, 2) not null check (valor > 0),
  data date not null default current_date,
  nota_id uuid references public.mei_notas on delete set null,
  origem text not null default 'app',
  criado_em timestamptz not null default now()
);
create index mei_lancamentos_user_data on public.mei_lancamentos (user_id, data);
create index mei_lancamentos_nota on public.mei_lancamentos (nota_id);
alter table public.mei_lancamentos enable row level security;
create policy mei_lancamentos_dono on public.mei_lancamentos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.mei_das (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  pago boolean not null default true,
  pago_em date not null default current_date,
  primary key (user_id, competencia)
);
alter table public.mei_das enable row level security;
create policy mei_das_dono on public.mei_das for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.mei_dasn (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ano integer not null,
  receita_comercio numeric(12, 2) not null default 0,
  receita_servico numeric(12, 2) not null default 0,
  teve_empregado boolean not null default false,
  status text not null default 'solicitada' check (status in ('solicitada', 'entregue')),
  recibo text not null default '',
  obs text not null default '',
  solicitada_em timestamptz not null default now(),
  entregue_em timestamptz,
  unique (user_id, ano)
);
alter table public.mei_dasn enable row level security;
create policy mei_dasn_ler on public.mei_dasn for select to authenticated
  using (user_id = (select auth.uid()) or public.mei_is_admin());
create policy mei_dasn_criar on public.mei_dasn for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'solicitada' and recibo = '' and entregue_em is null);
create policy mei_dasn_editar on public.mei_dasn for update to authenticated
  using ((user_id = (select auth.uid()) and status = 'solicitada') or public.mei_is_admin())
  with check ((user_id = (select auth.uid()) and status = 'solicitada' and recibo = '' and entregue_em is null) or public.mei_is_admin());
create policy mei_dasn_apagar on public.mei_dasn for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'solicitada');

-- Conversas do WhatsApp: estado só no servidor; o histórico o dono pode ler.
create table public.mei_whatsapp_sessoes (
  chave text primary key,
  estado jsonb not null default '{}',
  atualizado_em timestamptz not null default now()
);
alter table public.mei_whatsapp_sessoes enable row level security;

create table public.mei_whatsapp_msgs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  direcao text not null check (direcao in ('in', 'out')),
  canal text not null default 'whatsapp',
  texto text not null,
  criado_em timestamptz not null default now()
);
create index mei_whatsapp_msgs_user on public.mei_whatsapp_msgs (user_id, id);
alter table public.mei_whatsapp_msgs enable row level security;
create policy mei_whatsapp_msgs_ler on public.mei_whatsapp_msgs for select to authenticated
  using (user_id = (select auth.uid()));
