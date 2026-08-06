-- Veste Bem Admin - 012_company_assets_storage_policies.sql
-- Policies de Storage para logo e arquivos publicos da empresa.
-- NAO EXECUTAR SEM REVISAO.
--
-- Objetivo:
-- Criar o bucket publico company-assets para permitir exibir a logo em
-- recibos, relatorios, impressoes e demais telas publicas/autenticadas.
--
-- Caminho permitido para upload/update:
-- company-assets/company/logo/{arquivo}
--
-- Como o frontend deve usar upsert: true para troca de logo, o Storage precisa:
-- - insert quando o arquivo ainda nao existe;
-- - update quando o arquivo ja existe;
-- - select publico para leitura da logo.

begin;

-- Garante que o bucket exista e esteja publico para funcionar com getPublicUrl().
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do update
set public = true;

-- Leitura publica dos arquivos da empresa.
drop policy if exists "company_assets_public_select" on storage.objects;
create policy "company_assets_public_select"
on storage.objects for select
using (bucket_id = 'company-assets');

-- Administradores podem enviar nova logo da empresa.
drop policy if exists "company_assets_admin_insert_logo" on storage.objects;
create policy "company_assets_admin_insert_logo"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'company'
  and (storage.foldername(name))[2] = 'logo'
);

-- Administradores podem substituir a logo no mesmo caminho usando upsert.
drop policy if exists "company_assets_admin_update_logo" on storage.objects;
create policy "company_assets_admin_update_logo"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-assets'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'company'
  and (storage.foldername(name))[2] = 'logo'
)
with check (
  bucket_id = 'company-assets'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'company'
  and (storage.foldername(name))[2] = 'logo'
);

-- Nao criar policy de delete nesta etapa.
-- A troca de logo deve ocorrer por upsert no mesmo caminho.

commit;

-- Verificacoes manuais apos executar:

-- Deve retornar company-assets com public = true.
select id, name, public
from storage.buckets
where id = 'company-assets';

-- Deve listar as policies criadas para storage.objects.
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'company_assets_%'
order by policyname;
