-- Veste Bem Admin - 013_product_manual_sku.sql
-- Habilita referencia/SKU manual para produtos.

alter table public.products
  add column if not exists sku text null;

create index if not exists products_sku_idx
  on public.products (sku)
  where sku is not null;

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
  coalesce(pc_summary.color_images, '[]'::jsonb) as color_images,
  p.sku
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

revoke all on public.vw_products_seller from anon, authenticated;
grant select on public.vw_products_seller to authenticated;
