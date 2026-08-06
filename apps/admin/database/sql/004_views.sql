-- Veste Bem Admin - 004_views.sql
-- Views para revisao. Nao executar sem aprovacao.

create or replace view public.vw_products_seller as
select
  p.id,
  p.name,
  p.description,
  p.sale_price,
  p.image_url,
  p.status,
  p.created_at,
  p.updated_at
from public.products p
where p.status = 'active';

create or replace view public.vw_stock_seller as
select
  v.id as variation_id,
  p.id as product_id,
  p.name as product_name,
  v.color,
  v.size,
  v.quantity,
  v.minimum_stock,
  case
    when v.quantity = 0 then 'out_of_stock'
    when v.quantity <= v.minimum_stock then 'low_stock'
    else 'normal'
  end as stock_status,
  v.status as variation_status
from public.product_variations v
join public.products p on p.id = v.product_id
where p.status = 'active'
  and v.status = 'active';

create or replace view public.vw_sales_seller as
select
  s.id,
  s.operation_number,
  lpad(s.operation_number::text, 5, '0') as formatted_operation_number,
  s.customer_id,
  c.name as customer_name,
  s.channel,
  s.payment_method,
  s.gross_total,
  s.discount,
  s.net_total,
  s.status,
  s.invoice_requested,
  s.invoice_number,
  s.invoice_status,
  s.notes,
  s.created_by,
  s.created_at,
  s.updated_at,
  s.cancelled_at
from public.sales s
join public.customers c on c.id = s.customer_id;

create or replace view public.vw_orders_operational as
select
  o.id,
  o.operation_number,
  lpad(o.operation_number::text, 5, '0') as formatted_operation_number,
  o.origin,
  o.customer_id,
  c.name as customer_name,
  o.customer_whatsapp,
  o.customer_email,
  o.products_total,
  o.discount,
  o.shipping_value,
  o.total,
  o.payment_method,
  o.payment_status,
  o.order_status,
  o.city,
  o.state,
  o.shipping_method,
  o.carrier,
  o.estimated_deadline,
  o.paid_at,
  o.delivered_at,
  o.finalized_at,
  o.cancelled_at,
  o.created_at,
  o.updated_at
from public.orders o
join public.customers c on c.id = o.customer_id;

create or replace view public.vw_dashboard_pending_orders as
select *
from public.vw_orders_operational
where order_status in ('paid', 'in_separation', 'awaiting_shipping', 'shipped')
   or (order_status = 'delivered' and delivered_at > now() - interval '7 days');

create or replace view public.vw_financial_summary_admin as
select
  date_trunc('month', created_at)::date as month,
  sum(case when type = 'income' and status = 'active' then amount else 0 end) as total_income,
  sum(case when type = 'expense' and status = 'active' then amount else 0 end) as total_expense,
  sum(case when type = 'reversal' and status = 'active' then amount else 0 end) as total_reversal
from public.financial_entries
where public.is_admin()
group by date_trunc('month', created_at)::date;

revoke all on public.vw_products_seller from anon, authenticated;
revoke all on public.vw_stock_seller from anon, authenticated;
revoke all on public.vw_sales_seller from anon, authenticated;
revoke all on public.vw_orders_operational from anon, authenticated;
revoke all on public.vw_dashboard_pending_orders from anon, authenticated;
revoke all on public.vw_financial_summary_admin from anon, authenticated;

grant select on public.vw_products_seller to authenticated;
grant select on public.vw_stock_seller to authenticated;
grant select on public.vw_sales_seller to authenticated;
grant select on public.vw_orders_operational to authenticated;
grant select on public.vw_dashboard_pending_orders to authenticated;
grant select on public.vw_financial_summary_admin to authenticated;

-- Observacoes de seguranca:
-- - Views de vendedor nao expõem cost_price, unit_cost, total_cost ou estimated_gross_profit.
-- - Financeiro completo e auditoria permanecem protegidos por RLS e funcoes de permissao.
-- - Nao criar view publica para audit_logs.
