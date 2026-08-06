-- Veste Bem Admin - 006_product_colors_refactor.sql
-- Migracao proposta para transformar cores de produto em entidade propria.
-- NAO EXECUTAR SEM APROVACAO.
--
-- Objetivo:
-- products -> product_colors -> product_variations
--
-- Observacoes importantes:
-- - Este arquivo nao remove a coluna product_variations.color.
-- - Este arquivo nao aplica NOT NULL em product_variations.product_color_id.
-- - As queries finais ajudam a verificar se ainda existem dados orfaos antes de uma etapa futura.

begin;

-- 1. Criar entidade de cores do produto.
create table if not exists public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  color_name text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_colors_product_id_color_name_unique unique (product_id, color_name)
);

create index if not exists product_colors_product_id_idx
  on public.product_colors(product_id);

-- 2. Atualizar updated_at automaticamente, reaproveitando helper existente.
drop trigger if exists product_colors_touch_updated_at on public.product_colors;
create trigger product_colors_touch_updated_at
before update on public.product_colors
for each row execute function public.touch_updated_at();

-- 3. Adicionar FK nullable em product_variations.
alter table public.product_variations
add column if not exists product_color_id uuid references public.product_colors(id);

create index if not exists product_variations_product_color_id_idx
  on public.product_variations(product_color_id);

-- 4. Migrar cores existentes a partir de product_variations.color.
insert into public.product_colors (product_id, color_name, image_url, active)
select distinct
  pv.product_id,
  pv.color as color_name,
  null::text as image_url,
  true as active
from public.product_variations pv
where pv.color is not null
  and btrim(pv.color) <> ''
on conflict (product_id, color_name) do nothing;

-- 5. Preencher product_variations.product_color_id com base em product_id + color.
update public.product_variations pv
set product_color_id = pc.id
from public.product_colors pc
where pc.product_id = pv.product_id
  and pc.color_name = pv.color
  and pv.product_color_id is null;

-- 6. RLS para product_colors.
alter table public.product_colors enable row level security;

drop policy if exists "product_colors_admin_select" on public.product_colors;
create policy "product_colors_admin_select"
on public.product_colors for select
using (public.is_admin());

drop policy if exists "product_colors_admin_insert" on public.product_colors;
create policy "product_colors_admin_insert"
on public.product_colors for insert
with check (public.is_admin());

drop policy if exists "product_colors_admin_update" on public.product_colors;
create policy "product_colors_admin_update"
on public.product_colors for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "product_colors_seller_select_active" on public.product_colors;
create policy "product_colors_seller_select_active"
on public.product_colors for select
using (
  public.is_seller()
  and active = true
  and exists (
    select 1
    from public.products p
    where p.id = product_colors.product_id
      and p.status = 'active'
  )
);

-- Nao criar policy de delete. Cores devem ser inativadas, nao excluidas fisicamente.

revoke all on public.product_colors from anon, authenticated;
grant select, insert, update on public.product_colors to authenticated;

-- 7. Atualizar views operacionais mantendo as colunas antigas no inicio.
create or replace view public.vw_products_seller as
select
  p.id,
  p.name,
  p.description,
  p.sale_price,
  p.image_url,
  p.status,
  p.created_at,
  p.updated_at,
  coalesce(pc_summary.colors_count, 0) as colors_count,
  coalesce(pv_summary.variations_count, 0) as variations_count,
  coalesce(pv_summary.stock_total, 0) as stock_total,
  coalesce(pc_summary.color_images, '[]'::jsonb) as color_images
from public.products p
left join (
  select
    pc.product_id,
    count(*) filter (where pc.active = true) as colors_count,
    jsonb_agg(
      jsonb_build_object(
        'product_color_id', pc.id,
        'color_name', pc.color_name,
        'image_url', pc.image_url,
        'active', pc.active
      )
      order by pc.color_name
    ) filter (where pc.active = true) as color_images
  from public.product_colors pc
  group by pc.product_id
) pc_summary on pc_summary.product_id = p.id
left join (
  select
    pv.product_id,
    count(*) filter (where pv.status = 'active') as variations_count,
    sum(pv.quantity) filter (where pv.status = 'active') as stock_total
  from public.product_variations pv
  group by pv.product_id
) pv_summary on pv_summary.product_id = p.id
where p.status = 'active';

create or replace view public.vw_stock_seller as
select
  v.id as variation_id,
  p.id as product_id,
  p.name as product_name,
  coalesce(pc.color_name, v.color) as color,
  v.size,
  v.quantity,
  v.minimum_stock,
  case
    when v.quantity = 0 then 'out_of_stock'
    when v.quantity <= v.minimum_stock then 'low_stock'
    else 'normal'
  end as stock_status,
  v.status as variation_status,
  pc.id as product_color_id,
  pc.color_name,
  pc.image_url as color_image_url,
  pc.active as color_active
from public.product_variations v
join public.products p on p.id = v.product_id
left join public.product_colors pc on pc.id = v.product_color_id
where p.status = 'active'
  and v.status = 'active'
  and coalesce(pc.active, true) = true;

revoke all on public.vw_products_seller from anon, authenticated;
revoke all on public.vw_stock_seller from anon, authenticated;

grant select on public.vw_products_seller to authenticated;
grant select on public.vw_stock_seller to authenticated;

commit;

-- 8. Queries de verificacao pos-migracao.
-- Execute manualmente apos o commit para revisar se a migracao ficou consistente.

-- Deve retornar zero linhas antes de uma futura etapa com NOT NULL.
select
  id,
  product_id,
  color,
  size,
  status
from public.product_variations
where product_color_id is null
order by product_id, color, size;

-- Deve retornar zero linhas. Detecta possiveis duplicidades de cor por produto.
select
  product_id,
  color_name,
  count(*) as total
from public.product_colors
group by product_id, color_name
having count(*) > 1;

-- Amostra para validar o relacionamento product -> color -> variation.
select
  p.name as product_name,
  pc.color_name,
  pc.image_url,
  pv.size,
  pv.quantity,
  pv.minimum_stock,
  pv.status
from public.product_variations pv
join public.products p on p.id = pv.product_id
left join public.product_colors pc on pc.id = pv.product_color_id
order by p.name, pc.color_name, pv.size
limit 100;

