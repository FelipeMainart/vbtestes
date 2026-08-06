select
  schemaname as view_schema,
  viewname as view_name,
  viewowner as owner,
  definition
from pg_catalog.pg_views
where schemaname = 'public'
order by viewname;

