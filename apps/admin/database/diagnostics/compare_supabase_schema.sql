-- Veste Bem Admin - diagnostico de schema somente leitura
-- Execute no SQL Editor do Supabase e exporte cada resultado.
-- Este arquivo consulta apenas catalogos do PostgreSQL e metadados do Storage.

-- 1. Versao do servidor e schemas relevantes.
select version() as postgres_version;

select schema_name
from information_schema.schemata
where schema_name in ('public', 'auth', 'storage')
order by schema_name;

-- 2. Tabelas e estado de RLS.
select
  n.nspname as table_schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_get_userbyid(c.relowner) as owner
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname in ('public', 'storage')
order by n.nspname, c.relname;

-- 3. Colunas, tipos, nulabilidade, defaults e identidade.
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default,
  is_identity,
  identity_generation
from information_schema.columns
where table_schema in ('public', 'storage')
order by table_schema, table_name, ordinal_position;

-- 4. Constraints, incluindo checks, PKs, uniques e FKs.
select
  n.nspname as table_schema,
  c.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'p' then 'PRIMARY KEY'
    when 'f' then 'FOREIGN KEY'
    when 'u' then 'UNIQUE'
    when 'c' then 'CHECK'
    when 'x' then 'EXCLUSION'
    else con.contype::text
  end as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition,
  con.convalidated as validated
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, constraint_type, con.conname;

-- 5. Foreign keys em formato de relacionamento.
select
  src_ns.nspname as source_schema,
  src.relname as source_table,
  con.conname as foreign_key,
  tgt_ns.nspname as target_schema,
  tgt.relname as target_table,
  pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class src on src.oid = con.conrelid
join pg_catalog.pg_namespace src_ns on src_ns.oid = src.relnamespace
join pg_catalog.pg_class tgt on tgt.oid = con.confrelid
join pg_catalog.pg_namespace tgt_ns on tgt_ns.oid = tgt.relnamespace
where con.contype = 'f'
  and src_ns.nspname = 'public'
order by src.relname, con.conname;

-- 6. Indices.
select
  schemaname as table_schema,
  tablename as table_name,
  indexname as index_name,
  indexdef as definition
from pg_catalog.pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 7. Views e suas definicoes atuais.
select
  schemaname as view_schema,
  viewname as view_name,
  viewowner as owner,
  definition
from pg_catalog.pg_views
where schemaname = 'public'
order by viewname;

-- 8. Funcoes: assinatura, linguagem, volatilidade e security definer.
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language,
  case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end as volatility,
  p.prosecdef as security_definer,
  p.proconfig as runtime_settings,
  pg_get_userbyid(p.proowner) as owner,
  pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
join pg_catalog.pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname, identity_arguments;

-- 9. Triggers nao internos.
select
  n.nspname as table_schema,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as enabled_state,
  pg_get_triggerdef(t.oid, true) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
order by c.relname, t.tgname;

-- 10. Policies RLS.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 11. Grants de tabelas/views para papeis da aplicacao.
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by table_schema, table_name, grantee, privilege_type;

-- 12. Grants de funcoes para papeis da aplicacao.
select
  routine_schema,
  routine_name,
  specific_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_routine_grants
where routine_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by routine_name, specific_name, grantee;

-- 13. Buckets do Storage esperados e configuracao efetiva.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
where id in ('product-images', 'company-assets')
order by id;

-- 14. Resumo de contagem para detectar ausencias rapidamente.
select 'tables' as object_type, count(*) as total
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'views', count(*)
from information_schema.views
where table_schema = 'public'
union all
select 'functions', count(*)
from information_schema.routines
where routine_schema = 'public'
union all
select 'policies', count(*)
from pg_catalog.pg_policies
where schemaname = 'public'
union all
select 'triggers', count(*)
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname = 'public';

