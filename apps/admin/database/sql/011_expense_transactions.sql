-- Veste Bem Admin - 011_expense_transactions.sql
-- Funcoes transacionais para baixa e cancelamento de despesas.
-- NAO EXECUTAR SEM REVISAO.
--
-- Dependencias:
-- - database/sql/010_finance_suppliers_expense_payments_proposal.sql
-- - expenses.status
-- - expenses.paid_at
-- - expenses.paid_payment_method
-- - expenses.payment_notes
--
-- Objetivo:
-- - Dar baixa em despesas de forma transacional.
-- - Cancelar despesas sem exclusao fisica.
-- - Manter financial_entries consistente.
-- - Registrar auditoria com before_data, after_data, usuario, data e motivo/contexto.

begin;

create or replace function public.pay_expense(
  p_expense_id uuid,
  p_payment_date date,
  p_payment_method text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.expenses;
  v_before jsonb;
  v_after jsonb;
  v_financial_entry_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admin can pay expenses';
  end if;

  if p_expense_id is null then
    raise exception 'Expense id is required';
  end if;

  if p_payment_date is null then
    raise exception 'Payment date is required';
  end if;

  if p_payment_method not in ('pix', 'cash', 'card', 'bank_transfer', 'other') then
    raise exception 'Invalid payment method';
  end if;

  select * into v_expense
  from public.expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception 'Expense not found';
  end if;

  if v_expense.status = 'cancelled' or v_expense.deleted_at is not null then
    raise exception 'Cancelled expense cannot be paid';
  end if;

  if v_expense.status = 'paid' then
    raise exception 'Expense is already paid';
  end if;

  select jsonb_build_object(
    'expense', to_jsonb(e),
    'financial_entries', coalesce(
      (
        select jsonb_agg(to_jsonb(fe) order by fe.created_at)
        from public.financial_entries fe
        where fe.reference_type = 'expense'
          and (fe.reference_id = e.id or fe.id = e.financial_entry_id)
      ),
      '[]'::jsonb
    )
  )
  into v_before
  from public.expenses e
  where e.id = p_expense_id;

  if v_expense.financial_entry_id is not null then
    select id into v_financial_entry_id
    from public.financial_entries
    where id = v_expense.financial_entry_id
      and type = 'expense'
    for update;
  end if;

  if v_financial_entry_id is null then
    select id into v_financial_entry_id
    from public.financial_entries
    where reference_type = 'expense'
      and reference_id = p_expense_id
      and type = 'expense'
    order by created_at desc
    limit 1
    for update;
  end if;

  if v_financial_entry_id is null then
    insert into public.financial_entries (
      type,
      origin,
      category,
      description,
      amount,
      status,
      reference_type,
      reference_id,
      created_by
    )
    values (
      'expense',
      'manual',
      v_expense.category,
      coalesce(v_expense.description, 'Despesa manual'),
      v_expense.amount,
      'active',
      'expense',
      p_expense_id,
      auth.uid()
    )
    returning id into v_financial_entry_id;
  else
    update public.financial_entries
    set category = v_expense.category,
        description = coalesce(v_expense.description, 'Despesa manual'),
        amount = v_expense.amount,
        status = 'active',
        updated_by = auth.uid()
    where id = v_financial_entry_id;
  end if;

  update public.expenses
  set status = 'paid',
      paid_at = p_payment_date,
      paid_payment_method = p_payment_method,
      payment_method = p_payment_method,
      payment_notes = p_notes,
      financial_entry_id = v_financial_entry_id,
      updated_by = auth.uid()
  where id = p_expense_id;

  select jsonb_build_object(
    'expense', to_jsonb(e),
    'financial_entries', coalesce(
      (
        select jsonb_agg(to_jsonb(fe) order by fe.created_at)
        from public.financial_entries fe
        where fe.reference_type = 'expense'
          and (fe.reference_id = e.id or fe.id = e.financial_entry_id)
      ),
      '[]'::jsonb
    ),
    'payment_context', jsonb_build_object(
      'payment_date', p_payment_date,
      'payment_method', p_payment_method,
      'notes', p_notes,
      'paid_by', auth.uid(),
      'paid_at', now()
    )
  )
  into v_after
  from public.expenses e
  where e.id = p_expense_id;

  perform public.create_audit_log(
    'pay',
    'finance',
    'expense',
    p_expense_id,
    v_before,
    v_after
  );

  return p_expense_id;
end;
$$;

create or replace function public.cancel_expense(
  p_expense_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.expenses;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admin can cancel expenses';
  end if;

  if p_expense_id is null then
    raise exception 'Expense id is required';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancellation reason is required';
  end if;

  select * into v_expense
  from public.expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception 'Expense not found';
  end if;

  if v_expense.status = 'cancelled' or v_expense.deleted_at is not null then
    raise exception 'Expense is already cancelled';
  end if;

  select jsonb_build_object(
    'expense', to_jsonb(e),
    'financial_entries', coalesce(
      (
        select jsonb_agg(to_jsonb(fe) order by fe.created_at)
        from public.financial_entries fe
        where fe.reference_type = 'expense'
          and (fe.reference_id = e.id or fe.id = e.financial_entry_id)
      ),
      '[]'::jsonb
    )
  )
  into v_before
  from public.expenses e
  where e.id = p_expense_id;

  update public.financial_entries
  set status = 'cancelled',
      updated_by = auth.uid()
  where reference_type = 'expense'
    and (reference_id = p_expense_id or id = v_expense.financial_entry_id)
    and status = 'active';

  update public.expenses
  set status = 'cancelled',
      payment_notes = concat_ws(
        E'\n',
        nullif(payment_notes, ''),
        concat('Cancelamento: ', trim(p_reason))
      ),
      updated_by = auth.uid()
  where id = p_expense_id;

  select jsonb_build_object(
    'expense', to_jsonb(e),
    'financial_entries', coalesce(
      (
        select jsonb_agg(to_jsonb(fe) order by fe.created_at)
        from public.financial_entries fe
        where fe.reference_type = 'expense'
          and (fe.reference_id = e.id or fe.id = e.financial_entry_id)
      ),
      '[]'::jsonb
    ),
    'cancel_context', jsonb_build_object(
      'reason', p_reason,
      'cancelled_by', auth.uid(),
      'cancelled_at', now()
    )
  )
  into v_after
  from public.expenses e
  where e.id = p_expense_id;

  perform public.create_audit_log(
    'cancel',
    'finance',
    'expense',
    p_expense_id,
    v_before,
    v_after
  );

  return p_expense_id;
end;
$$;

revoke execute on function public.pay_expense(uuid, date, text, text)
from public, anon, authenticated;

revoke execute on function public.cancel_expense(uuid, text)
from public, anon, authenticated;

grant execute on function public.pay_expense(uuid, date, text, text)
to authenticated;

grant execute on function public.cancel_expense(uuid, text)
to authenticated;

commit;

-- Verificacoes manuais apos executar:

-- Deve retornar as funcoes criadas.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('pay_expense', 'cancel_expense')
order by p.proname;

-- Deve mostrar permissao de execute para authenticated.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('pay_expense', 'cancel_expense')
  and array_to_string(coalesce(p.proacl, array[]::aclitem[]), ',') like '%authenticated%';
