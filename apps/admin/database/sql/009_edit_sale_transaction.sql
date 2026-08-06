-- Veste Bem Admin - 009_edit_sale_transaction.sql
-- Funcao transacional para editar venda com seguranca.
-- NAO EXECUTAR SEM REVISAO.
--
-- Objetivo:
-- editar uma venda sem updates manuais perigosos no frontend.
--
-- Regras principais:
-- - Admin pode editar venda a qualquer momento.
-- - Seller pode editar apenas vendas criadas ha no maximo 24 horas.
-- - Seller deve informar motivo.
-- - Venda cancelada nao pode ser editada.
-- - Estoque antigo e devolvido antes da aplicacao dos novos itens.
-- - Novos itens sao validados contra estoque disponivel apos devolucao.
-- - Financeiro automatico vinculado a venda e atualizado, sem duplicidade.
-- - Auditoria registra antes, depois, usuario, perfil e motivo.
-- - Cor do item vem de product_variations.product_color_id -> product_colors.color_name.
-- - Nao depender de product_variations.color; coluna legada segue apenas para compatibilidade.

begin;

create or replace function public.edit_sale_with_items(
  p_sale_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_payment_method text,
  p_discount numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_customer_id uuid;
  v_user_role text;
  v_before jsonb;
  v_after jsonb;
  v_old_item record;
  v_item jsonb;
  v_product public.products;
  v_variation public.product_variations;
  v_color_name text;
  v_quantity integer;
  v_unit_price numeric(10,2);
  v_gross_total numeric(10,2) := 0;
  v_total_cost numeric(10,2) := 0;
  v_net_total numeric(10,2) := 0;
  v_updated_financial_count integer := 0;
begin
  if not public.is_active_user() then
    raise exception 'Inactive or unauthenticated user';
  end if;

  select role into v_user_role
  from public.profiles
  where id = auth.uid()
    and active = true;

  if v_user_role not in ('admin', 'seller') then
    raise exception 'Only admin or seller can edit sales';
  end if;

  if p_channel not in ('physical_store', 'whatsapp', 'instagram', 'site') then
    raise exception 'Invalid sale channel';
  end if;

  if p_payment_method not in ('pix', 'cash', 'card') then
    raise exception 'Invalid payment method';
  end if;

  if p_discount < 0 then
    raise exception 'Discount cannot be negative';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale must include at least one item';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found';
  end if;

  if v_sale.status = 'cancelled' then
    raise exception 'Cancelled sale cannot be edited';
  end if;

  if v_user_role = 'seller' then
    if v_sale.created_at < now() - interval '24 hours' then
      raise exception 'Esta venda so pode ser alterada por um administrador.';
    end if;

    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'Seller must provide a reason to edit a sale';
    end if;
  end if;

  if p_customer_id is null then
    select id into v_customer_id
    from public.customers
    where is_default = true
    limit 1;
  else
    v_customer_id := p_customer_id;
  end if;

  if v_customer_id is null then
    raise exception 'Customer is required and default customer was not found';
  end if;

  if not exists (select 1 from public.customers where id = v_customer_id) then
    raise exception 'Customer not found';
  end if;

  select jsonb_build_object(
    'sale', to_jsonb(s),
    'items', coalesce(
      (
        select jsonb_agg(to_jsonb(si) order by si.id)
        from public.sale_items si
        where si.sale_id = s.id
      ),
      '[]'::jsonb
    ),
    'financial_entries', coalesce(
      (
        select jsonb_agg(to_jsonb(fe) order by fe.created_at)
        from public.financial_entries fe
        where fe.reference_type = 'sale'
          and fe.reference_id = s.id
          and fe.origin = 'automatic'
      ),
      '[]'::jsonb
    )
  )
  into v_before
  from public.sales s
  where s.id = p_sale_id;

  -- Devolve o estoque dos itens antigos e registra stock_movements.
  for v_old_item in
    select variation_id, quantity
    from public.sale_items
    where sale_id = p_sale_id
  loop
    perform public.adjust_stock(
      v_old_item.variation_id,
      'cancel_sale',
      v_old_item.quantity,
      coalesce(nullif(trim(p_reason), ''), 'Sale edit: previous item returned'),
      'sale',
      p_sale_id
    );
  end loop;

  delete from public.sale_items
  where sale_id = p_sale_id;

  -- Valida e aplica os novos itens. Como o estoque antigo ja foi devolvido,
  -- a checagem considera corretamente trocas de cor/tamanho/quantidade.
  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_color_name := null;
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, null);

    if v_quantity <= 0 then
      raise exception 'Item quantity must be greater than zero';
    end if;

    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'Item unit_price must be zero or greater';
    end if;

    select p.* into v_product
    from public.products p
    join public.product_variations pv on pv.product_id = p.id
    where pv.id = (v_item->>'variation_id')::uuid
      and p.status = 'active'
    for update of p;

    if not found then
      raise exception 'Product not found or inactive for variation %', v_item->>'variation_id';
    end if;

    select pv.* into v_variation
    from public.product_variations pv
    join public.product_colors pc on pc.id = pv.product_color_id
    where pv.id = (v_item->>'variation_id')::uuid
      and pv.product_id = v_product.id
      and pv.status = 'active'
      and pc.product_id = v_product.id
      and pc.active = true
    for update of pv;

    if not found then
      raise exception 'Variation/color not found, inactive or incompatible with product';
    end if;

    select pc.color_name into v_color_name
    from public.product_colors pc
    where pc.id = v_variation.product_color_id
      and pc.product_id = v_product.id
      and pc.active = true;

    if v_color_name is null then
      raise exception 'Product color not found or inactive for variation %', v_variation.id;
    end if;

    if v_variation.quantity < v_quantity then
      raise exception 'Insufficient stock for variation %', v_variation.id;
    end if;

    insert into public.sale_items (
      sale_id,
      product_id,
      variation_id,
      product_name,
      color,
      size,
      quantity,
      unit_price,
      unit_cost,
      subtotal,
      total_cost
    )
    values (
      p_sale_id,
      v_product.id,
      v_variation.id,
      v_product.name,
      v_color_name,
      v_variation.size,
      v_quantity,
      v_unit_price,
      v_product.cost_price,
      v_unit_price * v_quantity,
      v_product.cost_price * v_quantity
    );

    perform public.adjust_stock(
      v_variation.id,
      'sale',
      v_quantity,
      coalesce(nullif(trim(p_reason), ''), 'Sale edit: new item applied'),
      'sale',
      p_sale_id
    );

    v_gross_total := v_gross_total + (v_unit_price * v_quantity);
    v_total_cost := v_total_cost + (v_product.cost_price * v_quantity);
  end loop;

  if p_discount > v_gross_total then
    raise exception 'Discount cannot be greater than gross total';
  end if;

  v_net_total := v_gross_total - p_discount;

  update public.sales
  set customer_id = v_customer_id,
      channel = p_channel,
      payment_method = p_payment_method,
      gross_total = v_gross_total,
      discount = p_discount,
      net_total = v_net_total,
      total_cost = v_total_cost,
      estimated_gross_profit = v_net_total - v_total_cost,
      notes = p_notes,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_sale_id;

  update public.financial_entries
  set amount = v_net_total,
      description = 'Venda atualizada',
      updated_by = auth.uid()
  where reference_type = 'sale'
    and reference_id = p_sale_id
    and origin = 'automatic'
    and type = 'income'
    and status = 'active';

  get diagnostics v_updated_financial_count = row_count;

  if v_updated_financial_count = 0 then
    insert into public.financial_entries (
      type,
      origin,
      category,
      description,
      amount,
      reference_type,
      reference_id,
      created_by
    )
    values (
      'income',
      'automatic',
      'sale_income',
      'Venda atualizada',
      v_net_total,
      'sale',
      p_sale_id,
      auth.uid()
    );
  end if;

  select jsonb_build_object(
    'sale', to_jsonb(s),
    'items', coalesce(
      (
        select jsonb_agg(to_jsonb(si) order by si.id)
        from public.sale_items si
        where si.sale_id = s.id
      ),
      '[]'::jsonb
    ),
    'financial_entries', coalesce(
      (
        select jsonb_agg(to_jsonb(fe) order by fe.created_at)
        from public.financial_entries fe
        where fe.reference_type = 'sale'
          and fe.reference_id = s.id
          and fe.origin = 'automatic'
      ),
      '[]'::jsonb
    ),
    'edit_context', jsonb_build_object(
      'reason', p_reason,
      'edited_by', auth.uid(),
      'user_role', v_user_role,
      'edited_at', now()
    )
  )
  into v_after
  from public.sales s
  where s.id = p_sale_id;

  perform public.create_audit_log(
    'update',
    'sales',
    'sale',
    p_sale_id,
    v_before,
    v_after
  );

  return p_sale_id;
end;
$$;

revoke execute on function public.edit_sale_with_items(uuid, uuid, text, text, numeric, text, jsonb, text)
from public, anon, authenticated;

grant execute on function public.edit_sale_with_items(uuid, uuid, text, text, numeric, text, jsonb, text)
to authenticated;

commit;

-- Verificacoes manuais apos executar:

-- Deve retornar a funcao criada.
select proname
from pg_proc
where proname = 'edit_sale_with_items';

-- Deve mostrar permissao de execute para authenticated.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'edit_sale_with_items';
