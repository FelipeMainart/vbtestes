-- Veste Bem Admin - 001_schema.sql
-- Schema base para revisao. Nao executar sem aprovacao.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin', 'seller')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operation_sequence (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('sale', 'order')),
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text,
  email text,
  city text,
  cpf text,
  notes text,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_single_default_idx
  on public.customers (is_default)
  where is_default = true;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sale_price numeric(10,2) not null default 0 check (sale_price >= 0),
  cost_price numeric(10,2) not null default 0 check (cost_price >= 0),
  image_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  color text not null,
  size text not null,
  quantity integer not null default 0 check (quantity >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color, size)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  operation_number bigint not null unique,
  customer_id uuid not null references public.customers(id),
  channel text not null check (channel in ('physical_store', 'whatsapp', 'instagram', 'site')),
  payment_method text not null check (payment_method in ('pix', 'cash', 'card')),
  gross_total numeric(10,2) not null default 0 check (gross_total >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  net_total numeric(10,2) not null default 0 check (net_total >= 0),
  total_cost numeric(10,2) not null default 0 check (total_cost >= 0),
  estimated_gross_profit numeric(10,2) not null default 0,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  invoice_requested boolean not null default false,
  invoice_number text,
  invoice_status text not null default 'none' check (invoice_status in ('none', 'pending', 'issued')),
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id),
  variation_id uuid not null references public.product_variations(id),
  product_name text not null,
  color text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  unit_cost numeric(10,2) not null check (unit_cost >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  total_cost numeric(10,2) not null check (total_cost >= 0)
);

create table if not exists public.orders (
  -- Pedidos serao criados futuramente pelo site via funcao controlada,
  -- Edge Function ou service role. O painel nao tera botao Novo Pedido.
  id uuid primary key default gen_random_uuid(),
  operation_number bigint not null unique,
  origin text not null default 'site' check (origin in ('site')),
  customer_id uuid not null references public.customers(id),
  customer_whatsapp text,
  customer_email text,
  customer_cpf text,
  products_total numeric(10,2) not null default 0 check (products_total >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  shipping_value numeric(10,2) not null default 0 check (shipping_value >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  payment_method text check (payment_method in ('pix', 'cash', 'card')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'cancelled', 'refunded')),
  order_status text not null default 'awaiting_payment' check (
    order_status in (
      'awaiting_payment',
      'paid',
      'in_separation',
      'awaiting_shipping',
      'shipped',
      'delivered',
      'finalized',
      'cancelled'
    )
  ),
  postal_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  shipping_method text,
  carrier text,
  estimated_deadline text,
  internal_notes text,
  paid_at timestamptz,
  delivered_at timestamptz,
  finalized_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  variation_id uuid not null references public.product_variations(id),
  product_name text not null,
  color text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  unit_cost numeric(10,2) not null check (unit_cost >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  total_cost numeric(10,2) not null check (total_cost >= 0)
);

create table if not exists public.order_tracking (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  tracking_code text,
  tracking_link text,
  carrier text,
  shipped_at timestamptz,
  estimated_delivery_date date,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variation_id uuid not null references public.product_variations(id),
  movement_type text not null check (
    movement_type in ('entry', 'exit', 'adjustment', 'sale', 'order', 'cancel_sale', 'cancel_order')
  ),
  quantity integer not null check (quantity > 0),
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity integer not null check (new_quantity >= 0),
  reason text,
  reference_type text check (reference_type in ('sale', 'order', 'manual')),
  reference_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense', 'reversal')),
  origin text not null check (origin in ('automatic', 'manual')),
  category text not null,
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  reference_type text check (reference_type in ('sale', 'order', 'expense')),
  reference_id uuid,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  financial_entry_id uuid references public.financial_entries(id),
  category text not null,
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  payment_method text check (payment_method in ('pix', 'cash', 'card', 'bank_transfer', 'other')),
  expense_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  user_role text,
  action text not null,
  module text not null,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists product_variations_product_id_idx on public.product_variations(product_id);
create index if not exists sales_customer_id_idx on public.sales(customer_id);
create index if not exists sales_operation_number_idx on public.sales(operation_number);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_operation_number_idx on public.orders(operation_number);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists stock_movements_variation_id_idx on public.stock_movements(variation_id);
create index if not exists financial_entries_reference_idx on public.financial_entries(reference_type, reference_id);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at);
