-- ===========================================================
-- Nome: Políticas RLS de site_product_media
-- Descrição: Leitura pública das cores e galerias vinculadas a produtos publicados no Site.
-- Status: V1
-- Dependências: public.product_colors; public.site_product_settings; public.site_product_media
-- Ordem de execução: 4
-- Data de criação: 2026-08-06
-- Última atualização: 2026-08-06
-- ===========================================================

-- SQL

alter table public.site_product_media enable row level security;

revoke all on public.site_product_media
  from public, anon, authenticated;

grant select on public.site_product_media
  to anon, authenticated;

grant select, insert, update, delete on public.site_product_media
  to service_role;

grant select on public.product_colors
  to anon, authenticated;

drop policy if exists "Public can read active colors from published site products"
  on public.product_colors;

create policy "Public can read active colors from published site products"
on public.product_colors
for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1
    from public.site_product_settings
    where site_product_settings.product_id = product_colors.product_id
      and site_product_settings.is_published = true
  )
);

drop policy if exists "Public can read media from published site products"
  on public.site_product_media;

create policy "Public can read media from published site products"
on public.site_product_media
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.product_colors
    join public.site_product_settings
      on site_product_settings.product_id = product_colors.product_id
    where product_colors.id = site_product_media.product_color_id
      and product_colors.active = true
      and site_product_settings.is_published = true
  )
);

-- Comentários finais
-- A galeria é pública somente quando a cor está ativa e o produto está publicado no Site.
-- A view vw_site_products continua responsável por expor somente produtos comercialmente ativos.
-- A policy adicional de product_colors é necessária porque a Arquitetura Oficial V1 determina consumo direto dessa tabela, sem vw_site_product_colors.
-- Nenhuma policy de escrita é concedida a anon ou authenticated nesta versão.
-- Escritas futuras deverão ocorrer exclusivamente em backend confiável com service_role.
-- A criação deste arquivo não significa que o SQL tenha sido executado.
