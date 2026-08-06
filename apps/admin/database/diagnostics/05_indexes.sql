select
  schemaname as table_schema,
  tablename as table_name,
  indexname as index_name,
  indexdef as definition
from pg_catalog.pg_indexes
where schemaname = 'public'
order by tablename, indexname;

