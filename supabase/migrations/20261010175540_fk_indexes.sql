create index if not exists accounts_connection_id_idx on public.accounts (connection_id);
create index if not exists assessor_messages_transaction_id_idx on public.assessor_messages (transaction_id);
create index if not exists budgets_category_id_idx on public.budgets (category_id);
create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists transactions_account_id_idx on public.transactions (account_id);
create index if not exists transactions_category_id_idx on public.transactions (category_id);
