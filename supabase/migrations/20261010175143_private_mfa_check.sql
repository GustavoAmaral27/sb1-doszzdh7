-- Tira a checagem de 2FA da API pública (/rest/v1/rpc); as políticas RLS continuam usando-a.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.mfa_ok() set schema private;
