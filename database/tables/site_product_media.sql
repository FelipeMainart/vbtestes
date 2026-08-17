-- ===========================================================
-- Nome: site_product_media
-- Descrição: Galeria complementar do e-commerce vinculada às cores dos produtos.
-- Status: V1
-- Dependências: public.product_colors; public.touch_updated_at()
-- Ordem de execução: 2
-- Data de criação: 2026-08-06
-- Última atualização: 2026-08-06
-- ===========================================================

-- SQL

create table if not exists public.site_product_media (
  id uuid primary key default gen_random_uuid(),

  product_color_id uuid not null
    references public.product_colors(id)
    on update cascade
    on delete cascade,

  storage_path text not null,
  alt_text text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0
    check (sort_order >= 0),
  mime_type text,
  width integer
    check (width is null or width > 0),
  height integer
    check (height is null or height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint site_product_media_storage_path_unique
    unique (storage_path)
);

create index if not exists site_product_media_product_color_id_idx
  on public.site_product_media (product_color_id);

create index if not exists site_product_media_gallery_order_idx
  on public.site_product_media (product_color_id, sort_order, created_at);

create unique index if not exists site_product_media_one_primary_per_color_idx
  on public.site_product_media (product_color_id)
  where is_primary = true;

drop trigger if exists site_product_media_touch_updated_at
  on public.site_product_media;

create trigger site_product_media_touch_updated_at
before update on public.site_product_media
for each row execute function public.touch_updated_at();

comment on table public.site_product_media is
  'Galeria complementar do e-commerce; cada cor pode possuir múltiplas imagens.';

comment on column public.site_product_media.id is
  'Identificador único da mídia complementar.';

comment on column public.site_product_media.product_color_id is
  'Cor do ERP à qual a imagem complementar pertence.';

comment on column public.site_product_media.storage_path is
  'Caminho do arquivo no bucket único de imagens do projeto.';

comment on column public.site_product_media.alt_text is
  'Texto alternativo utilizado para acessibilidade e SEO.';

comment on column public.site_product_media.is_primary is
  'Indica a foto principal utilizada pelo e-commerce para esta cor.';

comment on column public.site_product_media.sort_order is
  'Posição da imagem dentro da galeria da cor.';

comment on column public.site_product_media.mime_type is
  'Tipo MIME validado durante o futuro fluxo de upload.';

comment on column public.site_product_media.width is
  'Largura da imagem em pixels, quando disponível.';

comment on column public.site_product_media.height is
  'Altura da imagem em pixels, quando disponível.';

comment on column public.site_product_media.created_at is
  'Data e hora de criação do registro.';

comment on column public.site_product_media.updated_at is
  'Data e hora da última atualização, mantida pelo trigger touch_updated_at.';

-- Comentários finais
-- product_colors.image_url continua sendo a imagem principal mantida pelo ERP.
-- Esta tabela armazena somente a galeria complementar, sua ordem e a foto principal usada no e-commerce.
-- A criação deste arquivo não significa que o SQL tenha sido executado.
