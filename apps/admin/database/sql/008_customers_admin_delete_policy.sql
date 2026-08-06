-- Veste Bem Admin - 008_customers_admin_delete_policy.sql
-- Permite exclusao fisica de clientes somente para administradores.
-- NAO EXECUTAR SEM REVISAO.
--
-- Regras:
-- - Admin pode deletar clientes comuns.
-- - Seller nao pode deletar.
-- - Cliente Diversos nunca pode ser deletado.
-- - O frontend ja verifica vinculos com sales/orders antes de excluir.
-- - As FKs do banco continuam protegendo exclusoes com registros vinculados.

begin;

-- Necessario porque a tabela havia recebido apenas select, insert e update.
grant delete on public.customers to authenticated;

drop policy if exists "customers_admin_delete" on public.customers;
create policy "customers_admin_delete"
on public.customers for delete
using (
  public.is_admin()
  and is_default = false
  and lower(btrim(name)) <> 'cliente diversos'
);

commit;

-- Verificacoes manuais apos executar:

-- Deve listar a policy de delete criada.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'customers'
  and policyname = 'customers_admin_delete';

-- Deve retornar o Cliente Diversos protegido por is_default = true.
select id, name, is_default
from public.customers
where is_default = true
   or lower(btrim(name)) = 'cliente diversos';
