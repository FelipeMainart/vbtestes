-- ===========================================================
-- Nome: site_product_settings
-- Descrição: Configurações editoriais e de publicação dos produtos no Site.
-- Status: V1
-- Dependências: public.products; public.touch_updated_at()
-- Ordem de execução: 1
-- Data de criação: 2026-08-06
-- Última atualização: 2026-08-06
-- ===========================================================

-- SQL

create table if not exists public.site_product_settings (
  product_id uuid primary key
    references public.products(id)
    on update cascade
    on delete cascade,

  is_published boolean not null default false,
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_product_settings_published_idx
  on public.site_product_settings (is_published)
  where is_published = true;

create index if not exists site_product_settings_featured_idx
  on public.site_product_settings (is_featured)
  where is_featured = true;

drop trigger if exists site_product_settings_touch_updated_at
  on public.site_product_settings;

create trigger site_product_settings_touch_updated_at
before update on public.site_product_settings
for each row execute function public.touch_updated_at();

comment on table public.site_product_settings is
  'Configurações editoriais e de publicação dos produtos no Site.';

comment on column public.site_product_settings.product_id is
  'Produto do ERP ao qual pertence a configuração do Site; relação um para um com products.';

comment on column public.site_product_settings.is_published is
  'Indica se o produto está publicado no e-commerce, independentemente do status comercial do ERP.';

comment on column public.site_product_settings.is_featured is
  'Indica se o produto deve receber destaque editorial no Site.';

comment on column public.site_product_settings.seo_title is
  'Título editorial opcional para mecanismos de busca e compartilhamento.';

comment on column public.site_product_settings.seo_description is
  'Descrição editorial opcional para mecanismos de busca e compartilhamento.';

comment on column public.site_product_settings.published_at is
  'Data e hora da publicação mais recente; permanece nulo enquanto o produto não estiver publicado.';

comment on column public.site_product_settings.created_at is
  'Data e hora de criação da configuração.';

comment on column public.site_product_settings.updated_at is
  'Data e hora da última atualização, mantida pelo trigger touch_updated_at.';

-- Comentários finais
-- Esta tabela contém apenas decisões editoriais do Site.
-- Nome, SKU, preço, estoque, cores e tamanhos continuam pertencendo ao ERP.
-- A criação deste arquivo não significa que o SQL tenha sido executado.
