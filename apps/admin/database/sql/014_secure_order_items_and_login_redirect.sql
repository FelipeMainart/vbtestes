-- Veste Bem Admin - 014_secure_order_items_and_login_redirect.sql
-- Restringe custos de itens de pedidos a administradores e fornece uma
-- projeção operacional segura para vendedores.

drop policy if exists "order_items_authenticated_select" on public.order_items;
drop policy if exists "order_items_admin_select" on public.order_items;

create policy "order_items_admin_select"
on public.order_items for select
using (public.is_admin());

-- O grant permite que usuários autenticados alcancem a tabela, mas a RLS
-- acima autoriza linhas somente para administradores. Anon permanece sem grant.
revoke all on public.order_items from anon, authenticated;
grant select on public.order_items to authenticated;

create or replace function public.get_order_items_operational()
returns table (
  id uuid,
  order_id uuid,
  product_id uuid,
  variation_id uuid,
  product_name text,
  color text,
  size text,
  quantity integer,
  unit_price numeric(10,2),
  subtotal numeric(10,2)
)
language sql
stable
security definer
set search_path = public
as $$
  -- Este predicado replica o escopo atual da policy
  -- orders_authenticated_select: todo usuario ativo pode visualizar todos os
  -- pedidos. Se orders passar a ser limitado por loja, filial, responsavel ou
  -- outro criterio, este filtro deve ser atualizado na mesma migration da
  -- policy para nunca ampliar o escopo dos itens em relacao aos pedidos.
  select
    oi.id,
    oi.order_id,
    oi.product_id,
    oi.variation_id,
    oi.product_name,
    oi.color,
    oi.size,
    oi.quantity,
    oi.unit_price,
    oi.subtotal
  from public.order_items oi
  where public.is_active_user();
$$;

revoke all on function public.get_order_items_operational() from public, anon, authenticated;
grant execute on function public.get_order_items_operational() to authenticated;

comment on function public.get_order_items_operational() is
  'Retorna itens sem custos no mesmo escopo atual de orders_authenticated_select: todos os pedidos sao visiveis a qualquer usuario ativo. Toda futura restricao de orders por loja, filial, responsavel ou outro criterio deve ser aplicada tambem nesta funcao.';

drop view if exists public.order_items_seller_view;

create view public.order_items_seller_view
with (security_invoker = true)
as
select
  item.id,
  item.order_id,
  item.product_id,
  item.variation_id,
  item.product_name,
  item.color,
  item.size,
  item.quantity,
  item.unit_price,
  item.subtotal
from public.get_order_items_operational() item;

revoke all on public.order_items_seller_view from public, anon, authenticated;
grant select on public.order_items_seller_view to authenticated;

comment on view public.order_items_seller_view is
  'Itens operacionais de pedidos sem unit_cost, total_cost, margem ou lucro.';
