-- Veste Bem Admin - 007_product_images_storage_policies.sql
-- Policies de Storage para permitir upload/update de imagens de produtos.
-- NAO EXECUTAR SEM REVISAO.
--
-- Erro corrigido:
-- StorageApiError: new row violates row-level security policy
--
-- Contexto:
-- O frontend envia imagens das cores para:
-- product-images/products/{productId}/colors/{slug-da-cor}.webp
--
-- Como o upload usa upsert: true, o Supabase Storage precisa permitir:
-- - insert em storage.objects quando o arquivo ainda nao existe;
-- - update em storage.objects quando o arquivo ja existe;
-- - select para leitura das imagens publicas.

begin;

-- Garante que o bucket exista e esteja publico para funcionar com getPublicUrl().
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set public = true;

-- Leitura publica das imagens do bucket.
drop policy if exists "product_images_public_select" on storage.objects;
create policy "product_images_public_select"
on storage.objects for select
using (bucket_id = 'product-images');

-- Administradores podem enviar novas imagens de produto.
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'products'
);

-- Administradores podem substituir imagens existentes no mesmo caminho.
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'products'
)
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'products'
);

-- Nao criar policy de delete.
-- Imagens antigas nao devem acumular porque o frontend usa upsert no mesmo path.

commit;

-- Verificacoes manuais apos executar:

-- Deve retornar product-images com public = true.
select id, name, public
from storage.buckets
where id = 'product-images';

-- Deve listar as policies criadas para storage.objects.
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'product_images_%'
order by policyname;
