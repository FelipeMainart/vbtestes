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

