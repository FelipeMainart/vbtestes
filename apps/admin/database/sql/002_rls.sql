-- Veste Bem Admin - 002_rls.sql
-- Politicas RLS para revisao. Nao executar sem aprovacao.

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

create or replace function public.is_seller()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'seller'
      and active = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.operation_sequence enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.product_variations enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_tracking enable row level security;
alter table public.stock_movements enable row level security;
alter table public.financial_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
using (
  id = auth.uid()
  or public.is_admin()
);

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
on public.profiles for insert
with check (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "customers_authenticated_select" on public.customers;
create policy "customers_authenticated_select"
on public.customers for select
using (public.is_active_user());

drop policy if exists "customers_authenticated_insert" on public.customers;
create policy "customers_authenticated_insert"
on public.customers for insert
with check (public.is_active_user());

drop policy if exists "customers_authenticated_update" on public.customers;
create policy "customers_authenticated_update"
on public.customers for update
using (public.is_active_user())
with check (public.is_active_user());

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
on public.products for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "product_variations_admin_all" on public.product_variations;
create policy "product_variations_admin_all"
on public.product_variations for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sales_admin_select_all" on public.sales;
create policy "sales_admin_select_all"
on public.sales for select
using (public.is_admin());

-- Vendas devem ser criadas pela funcao transacional create_sale_with_items.
-- Nao ha policy de insert direto para vendedores em sales.
drop policy if exists "sales_seller_insert_completed" on public.sales;

drop policy if exists "sales_admin_update" on public.sales;
create policy "sales_admin_update"
on public.sales for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sale_items_admin_select_all" on public.sale_items;
create policy "sale_items_admin_select_all"
on public.sale_items for select
using (public.is_admin());

-- Itens de venda devem ser criados pela funcao transacional create_sale_with_items.
-- Nao ha policy de insert direto para vendedores em sale_items.
drop policy if exists "sale_items_active_insert" on public.sale_items;

drop policy if exists "orders_authenticated_select" on public.orders;
create policy "orders_authenticated_select"
on public.orders for select
using (public.is_active_user());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
on public.orders for update
using (public.is_admin())
with check (public.is_admin());

-- Pedidos devem ser alterados por funcoes controladas:
-- mark_order_paid, update_order_status, update_order_tracking, cancel_order.
-- Nao ha policy de update direto amplo para vendedores em orders.
drop policy if exists "orders_seller_operational_update" on public.orders;

drop policy if exists "order_items_authenticated_select" on public.order_items;
create policy "order_items_authenticated_select"
on public.order_items for select
using (public.is_active_user());

drop policy if exists "order_tracking_authenticated_select" on public.order_tracking;
create policy "order_tracking_authenticated_select"
on public.order_tracking for select
using (public.is_active_user());

-- Rastreio deve ser alterado pela funcao update_order_tracking.
-- Nao ha insert/update direto amplo em order_tracking.
drop policy if exists "order_tracking_authenticated_insert" on public.order_tracking;
drop policy if exists "order_tracking_authenticated_update" on public.order_tracking;

drop policy if exists "stock_movements_authenticated_select" on public.stock_movements;
create policy "stock_movements_authenticated_select"
on public.stock_movements for select
using (public.is_active_user());

-- Movimentos de estoque sao criados por funcoes controladas.
-- Ajustes manuais devem usar admin_adjust_stock.
drop policy if exists "stock_movements_admin_insert" on public.stock_movements;

drop policy if exists "financial_entries_admin_all" on public.financial_entries;
create policy "financial_entries_admin_all"
on public.financial_entries for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "expenses_admin_select" on public.expenses;
drop policy if exists "expenses_admin_all" on public.expenses;
create policy "expenses_admin_select"
on public.expenses for select
using (public.is_admin());

drop policy if exists "expenses_admin_insert" on public.expenses;
create policy "expenses_admin_insert"
on public.expenses for insert
with check (public.is_admin());

drop policy if exists "expenses_admin_update" on public.expenses;
create policy "expenses_admin_update"
on public.expenses for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select"
on public.audit_logs for select
using (public.is_admin());

drop policy if exists "audit_logs_system_insert" on public.audit_logs;
-- Auditoria e criada apenas por funcoes internas controladas.
-- Nao ha policy de insert direto em audit_logs para usuarios autenticados.

drop policy if exists "settings_admin_all" on public.settings;
create policy "settings_admin_all"
on public.settings for all
using (public.is_admin())
with check (public.is_admin());

-- operation_sequence deve ser manipulada por funcoes security definer.

revoke all on public.sales from anon, authenticated;
revoke all on public.sale_items from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.order_tracking from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_variations from anon, authenticated;
revoke all on public.stock_movements from anon, authenticated;
revoke all on public.financial_entries from anon, authenticated;
revoke all on public.expenses from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.operation_sequence from anon, authenticated;

grant select, insert, update on public.customers to authenticated;
grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.order_tracking to authenticated;
grant select on public.stock_movements to authenticated;
grant all on public.products to authenticated;
grant all on public.product_variations to authenticated;
grant all on public.financial_entries to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.settings to authenticated;
