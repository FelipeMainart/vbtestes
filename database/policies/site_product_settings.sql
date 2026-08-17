-- ===========================================================
-- Nome: Políticas RLS de site_product_settings
-- Descrição: Leitura pública controlada das configurações publicadas e escrita reservada ao backend.
-- Status: V1
-- Dependências: public.site_product_settings
-- Ordem de execução: 3
-- Data de criação: 2026-08-06
-- Última atualização: 2026-08-06
-- ===========================================================

-- SQL

alter table public.site_product_settings enable row level security;

revoke all on public.site_product_settings
  from public, anon, authenticated;

grant select on public.site_product_settings
  to anon, authenticated;

grant select, insert, update, delete on public.site_product_settings
  to service_role;

drop policy if exists "Public can read published site product settings"
  on public.site_product_settings;

create policy "Public can read published site product settings"
on public.site_product_settings
for select
to anon, authenticated
using (
  is_published = true
);

-- Comentários finais
-- anon e authenticated podem ler somente configurações publicadas.
-- A exposição dos dados comerciais continua limitada pela view vw_site_products, que retorna apenas produtos ativos.
-- Nenhuma policy de escrita é concedida a anon ou authenticated nesta versão.
-- Escritas futuras deverão ocorrer exclusivamente em backend confiável com service_role.
-- A criação deste arquivo não significa que o SQL tenha sido executado.
