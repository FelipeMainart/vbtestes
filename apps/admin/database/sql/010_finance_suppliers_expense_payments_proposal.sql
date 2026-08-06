-- Proposta SQL para evolução do módulo Financeiro.
-- Não executar sem aprovação.
--
-- Objetivo:
-- - cadastrar fornecedores;
-- - vincular despesas a fornecedores;
-- - registrar vencimento e baixa de despesas com campos próprios;
-- - preservar histórico sem exclusão física.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  whatsapp text,
  email text,
  city text,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.expenses
  add column if not exists supplier_id uuid references public.suppliers(id),
  add column if not exists due_date date,
  add column if not exists paid_at date,
  add column if not exists paid_payment_method text check (paid_payment_method in ('pix', 'cash', 'card', 'bank_transfer', 'other')),
  add column if not exists payment_notes text,
  add column if not exists status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled'));

create index if not exists suppliers_name_idx on public.suppliers(name);
create index if not exists suppliers_document_idx on public.suppliers(document);
create index if not exists expenses_supplier_id_idx on public.expenses(supplier_id);
create index if not exists expenses_due_date_idx on public.expenses(due_date);
create index if not exists expenses_status_idx on public.expenses(status);

drop trigger if exists suppliers_touch_updated_at on public.suppliers;
create trigger suppliers_touch_updated_at
before update on public.suppliers
for each row execute function public.touch_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_admin_select" on public.suppliers;
create policy "suppliers_admin_select"
on public.suppliers for select
to authenticated
using (public.is_admin());

drop policy if exists "suppliers_admin_insert" on public.suppliers;
create policy "suppliers_admin_insert"
on public.suppliers for insert
to authenticated
with check (public.is_admin());

drop policy if exists "suppliers_admin_update" on public.suppliers;
create policy "suppliers_admin_update"
on public.suppliers for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.suppliers to authenticated;

-- Recomendações para uma próxima etapa:
-- 1. Criar RPC transacional pay_expense(p_expense_id, p_paid_at, p_payment_method, p_notes)
--    para marcar expense.status = 'paid', preencher paid_at, criar/atualizar financial_entries
--    e registrar audit_logs.
-- 2. Criar RPC cancel_expense(p_expense_id, p_reason) para marcar expense.status = 'cancelled',
--    cancelar financial_entries vinculado e registrar audit_logs.
-- 3. Migrar dados estruturados atualmente em expenses.notes para supplier_id, due_date,
--    paid_at, paid_payment_method e payment_notes.
