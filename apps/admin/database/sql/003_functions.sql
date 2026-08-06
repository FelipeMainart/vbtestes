-- Veste Bem Admin - 003_functions.sql
-- Funcoes planejadas para revisao. Nao executar sem aprovacao.

create or replace function public.current_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1;
$$;

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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
before update on public.customers
for each row execute function public.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row execute function public.touch_updated_at();

drop trigger if exists product_variations_touch_updated_at on public.product_variations;
create trigger product_variations_touch_updated_at
before update on public.product_variations
for each row execute function public.touch_updated_at();

drop trigger if exists sales_touch_updated_at on public.sales;
create trigger sales_touch_updated_at
before update on public.sales
for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists order_tracking_touch_updated_at on public.order_tracking;
create trigger order_tracking_touch_updated_at
before update on public.order_tracking
for each row execute function public.touch_updated_at();

drop trigger if exists financial_entries_touch_updated_at on public.financial_entries;
create trigger financial_entries_touch_updated_at
before update on public.financial_entries
for each row execute function public.touch_updated_at();

drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at
before update on public.expenses
for each row execute function public.touch_updated_at();

create or replace function public.create_audit_log(
  p_action text,
  p_module text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  insert into public.audit_logs (
    user_id,
    user_role,
    action,
    module,
    entity_type,
    entity_id,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    v_role,
    p_action,
    p_module,
    p_entity_type,
    p_entity_id,
    p_before_data,
    p_after_data
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.next_operation_number(p_entity_type text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number bigint;
begin
  if p_entity_type not in ('sale', 'order') then
    raise exception 'Invalid operation entity type: %', p_entity_type;
  end if;

  insert into public.operation_sequence (entity_type)
  values (p_entity_type)
  returning id into v_number;

  return v_number;
end;
$$;

create or replace function public.adjust_stock(
  p_variation_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous integer;
  v_new integer;
begin
  if p_quantity <= 0 then
    raise exception 'Stock quantity must be greater than zero';
  end if;

  select quantity into v_previous
  from public.product_variations
  where id = p_variation_id
  for update;

  if not found then
    raise exception 'Variation not found';
  end if;

  if p_movement_type in ('entry', 'cancel_sale', 'cancel_order') then
    v_new := v_previous + p_quantity;
  elsif p_movement_type in ('exit', 'sale', 'order') then
    v_new := v_previous - p_quantity;
  elsif p_movement_type = 'adjustment' then
    v_new := p_quantity;
  else
    raise exception 'Invalid stock movement type: %', p_movement_type;
  end if;

  if v_new < 0 then
    raise exception 'Stock cannot be negative';
  end if;

  update public.product_variations
  set quantity = v_new
  where id = p_variation_id;

  insert into public.stock_movements (
    variation_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    reason,
    reference_type,
    reference_id,
    created_by
  )
  values (
    p_variation_id,
    p_movement_type,
    p_quantity,
    v_previous,
    v_new,
    p_reason,
    p_reference_type,
    p_reference_id,
    auth.uid()
  );
end;
$$;

create or replace function public.admin_adjust_stock(
  p_variation_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can adjust stock manually';
  end if;

  if p_movement_type not in ('entry', 'exit', 'adjustment') then
    raise exception 'Manual stock movement must be entry, exit or adjustment';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Manual stock movement requires a reason';
  end if;

  perform public.adjust_stock(
    p_variation_id,
    p_movement_type,
    p_quantity,
    p_reason,
    'manual',
    null
  );

  perform public.create_audit_log(
    'manual_stock_' || p_movement_type,
    'stock',
    'product_variation',
    p_variation_id,
    null,
    jsonb_build_object('quantity', p_quantity, 'reason', p_reason)
  );
end;
$$;

create or replace function public.create_sale_with_items(
  p_customer_id uuid,
  p_channel text,
  p_payment_method text,
  p_items jsonb,
  p_discount numeric default 0,
  p_notes text default null,
  p_invoice_requested boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_customer_id uuid;
  v_operation_number bigint;
  v_item jsonb;
  v_product public.products;
  v_variation public.product_variations;
  v_quantity integer;
  v_gross_total numeric(10,2) := 0;
  v_total_cost numeric(10,2) := 0;
  v_net_total numeric(10,2) := 0;
begin
  if not public.is_active_user() then
    raise exception 'Inactive or unauthenticated user';
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

  v_operation_number := public.next_operation_number('sale');

  insert into public.sales (
    operation_number,
    customer_id,
    channel,
    payment_method,
    gross_total,
    discount,
    net_total,
    total_cost,
    estimated_gross_profit,
    status,
    invoice_requested,
    notes,
    created_by
  )
  values (
    v_operation_number,
    v_customer_id,
    p_channel,
    p_payment_method,
    0,
    p_discount,
    0,
    0,
    0,
    'completed',
    p_invoice_requested,
    p_notes,
    auth.uid()
  )
  returning id into v_sale_id;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);

    if v_quantity <= 0 then
      raise exception 'Item quantity must be greater than zero';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and status = 'active'
    for update;

    if not found then
      raise exception 'Product not found or inactive';
    end if;

    select * into v_variation
    from public.product_variations
    where id = (v_item->>'variation_id')::uuid
      and product_id = v_product.id
      and status = 'active'
    for update;

    if not found then
      raise exception 'Variation not found, inactive or incompatible with product';
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
      v_sale_id,
      v_product.id,
      v_variation.id,
      v_product.name,
      v_variation.color,
      v_variation.size,
      v_quantity,
      v_product.sale_price,
      v_product.cost_price,
      v_product.sale_price * v_quantity,
      v_product.cost_price * v_quantity
    );

    perform public.adjust_stock(
      v_variation.id,
      'sale',
      v_quantity,
      'Sale completed',
      'sale',
      v_sale_id
    );

    v_gross_total := v_gross_total + (v_product.sale_price * v_quantity);
    v_total_cost := v_total_cost + (v_product.cost_price * v_quantity);
  end loop;

  if p_discount > v_gross_total then
    raise exception 'Discount cannot be greater than gross total';
  end if;

  v_net_total := v_gross_total - p_discount;

  update public.sales
  set gross_total = v_gross_total,
      net_total = v_net_total,
      total_cost = v_total_cost,
      estimated_gross_profit = v_net_total - v_total_cost
  where id = v_sale_id;

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
    'Venda concluida',
    v_net_total,
    'sale',
    v_sale_id,
    auth.uid()
  );

  perform public.create_audit_log(
    'create',
    'sales',
    'sale',
    v_sale_id,
    null,
    (
      select to_jsonb(s)
      from public.sales s
      where s.id = v_sale_id
    )
  );

  return v_sale_id;
end;
$$;

create or replace function public.cancel_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'Only admin can cancel sales';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found';
  end if;

  if v_sale.status = 'cancelled' then
    return;
  end if;

  for v_item in
    select variation_id, quantity
    from public.sale_items
    where sale_id = p_sale_id
  loop
    perform public.adjust_stock(
      v_item.variation_id,
      'cancel_sale',
      v_item.quantity,
      'Sale cancellation',
      'sale',
      p_sale_id
    );
  end loop;

  update public.sales
  set status = 'cancelled',
      cancelled_at = now(),
      updated_by = auth.uid()
  where id = p_sale_id;

  update public.financial_entries
  set status = 'cancelled',
      updated_by = auth.uid()
  where reference_type = 'sale'
    and reference_id = p_sale_id
    and origin = 'automatic'
    and status = 'active';

  perform public.create_audit_log(
    'cancel',
    'sales',
    'sale',
    p_sale_id,
    to_jsonb(v_sale),
    (
      select to_jsonb(s)
      from public.sales s
      where s.id = p_sale_id
    )
  );
end;
$$;

create or replace function public.mark_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'Only admin can mark orders as paid in this MVP';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status = 'paid' then
    return;
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'Cancelled order cannot be marked as paid';
  end if;

  for v_item in
    select oi.variation_id, oi.quantity, p.status as product_status, v.status as variation_status
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.product_variations v on v.id = oi.variation_id
    where oi.order_id = p_order_id
  loop
    if v_item.product_status <> 'active' or v_item.variation_status <> 'active' then
      raise exception 'Order contains inactive product or variation';
    end if;

    perform public.adjust_stock(
      v_item.variation_id,
      'order',
      v_item.quantity,
      'Order paid',
      'order',
      p_order_id
    );
  end loop;

  update public.orders
  set payment_status = 'paid',
      order_status = 'paid',
      paid_at = now()
  where id = p_order_id;

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
    'order_income',
    'Pedido pago',
    v_order.total,
    'order',
    p_order_id,
    auth.uid()
  );

  perform public.create_audit_log(
    'mark_paid',
    'orders',
    'order',
    p_order_id,
    to_jsonb(v_order),
    (select to_jsonb(o) from public.orders o where o.id = p_order_id)
  );
end;
$$;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_order_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_active_user() then
    raise exception 'Inactive or unauthenticated user';
  end if;

  if p_order_status not in ('in_separation', 'awaiting_shipping', 'shipped', 'delivered') then
    raise exception 'Invalid operational order status';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.order_status in ('cancelled', 'finalized') then
    raise exception 'Cannot update cancelled or finalized order';
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'Only paid orders can advance operational status';
  end if;

  update public.orders
  set order_status = p_order_status,
      delivered_at = case when p_order_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_order_id;

  perform public.create_audit_log(
    'update_status',
    'orders',
    'order',
    p_order_id,
    to_jsonb(v_order),
    (select to_jsonb(o) from public.orders o where o.id = p_order_id)
  );
end;
$$;

create or replace function public.update_order_tracking(
  p_order_id uuid,
  p_tracking_code text default null,
  p_tracking_link text default null,
  p_carrier text default null,
  p_shipped_at timestamptz default null,
  p_estimated_delivery_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracking_id uuid;
  v_before jsonb;
begin
  if not public.is_active_user() then
    raise exception 'Inactive or unauthenticated user';
  end if;

  if not exists (
    select 1
    from public.orders
    where id = p_order_id
      and order_status not in ('cancelled', 'finalized')
  ) then
    raise exception 'Order not found or cannot be tracked';
  end if;

  select to_jsonb(t), t.id
  into v_before, v_tracking_id
  from public.order_tracking t
  where t.order_id = p_order_id
  order by t.created_at desc
  limit 1;

  if v_tracking_id is null then
    insert into public.order_tracking (
      order_id,
      tracking_code,
      tracking_link,
      carrier,
      shipped_at,
      estimated_delivery_date
    )
    values (
      p_order_id,
      p_tracking_code,
      p_tracking_link,
      p_carrier,
      p_shipped_at,
      p_estimated_delivery_date
    )
    returning id into v_tracking_id;
  else
    update public.order_tracking
    set tracking_code = p_tracking_code,
        tracking_link = p_tracking_link,
        carrier = p_carrier,
        shipped_at = p_shipped_at,
        estimated_delivery_date = p_estimated_delivery_date
    where id = v_tracking_id;
  end if;

  perform public.create_audit_log(
    'update_tracking',
    'orders',
    'order_tracking',
    v_tracking_id,
    v_before,
    (select to_jsonb(t) from public.order_tracking t where t.id = v_tracking_id)
  );

  return v_tracking_id;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'Only admin can cancel orders';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.order_status = 'cancelled' then
    return;
  end if;

  if v_order.payment_status = 'paid' then
    for v_item in
      select variation_id, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      perform public.adjust_stock(
        v_item.variation_id,
        'cancel_order',
        v_item.quantity,
        'Order cancellation',
        'order',
        p_order_id
      );
    end loop;

    update public.financial_entries
    set status = 'cancelled',
        updated_by = auth.uid()
    where reference_type = 'order'
      and reference_id = p_order_id
      and origin = 'automatic'
      and status = 'active';
  end if;

  update public.orders
  set order_status = 'cancelled',
      payment_status = case when payment_status = 'pending' then 'cancelled' else payment_status end,
      cancelled_at = now()
  where id = p_order_id;

  perform public.create_audit_log(
    'cancel',
    'orders',
    'order',
    p_order_id,
    to_jsonb(v_order),
    (select to_jsonb(o) from public.orders o where o.id = p_order_id)
  );
end;
$$;

create or replace function public.finalize_delivered_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only admin can finalize delivered orders manually';
  end if;

  update public.orders
  set order_status = 'finalized',
      finalized_at = now()
  where order_status = 'delivered'
    and delivered_at is not null
    and delivered_at <= now() - interval '7 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.next_operation_number(text) from public, anon, authenticated;
revoke execute on function public.create_audit_log(text, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid, text, integer, text, text, uuid) from public, anon, authenticated;

grant execute on function public.create_sale_with_items(uuid, text, text, jsonb, numeric, text, boolean) to authenticated;
grant execute on function public.cancel_sale(uuid) to authenticated;
grant execute on function public.admin_adjust_stock(uuid, text, integer, text) to authenticated;
grant execute on function public.mark_order_paid(uuid) to authenticated;
grant execute on function public.update_order_status(uuid, text) to authenticated;
grant execute on function public.update_order_tracking(uuid, text, text, text, timestamptz, date) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.finalize_delivered_orders() to authenticated;
