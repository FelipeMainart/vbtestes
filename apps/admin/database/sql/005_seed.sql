-- Veste Bem Admin - 005_seed.sql
-- Seed minimo para revisao. Nao executar sem aprovacao.

insert into public.customers (
  name,
  whatsapp,
  email,
  city,
  cpf,
  notes,
  is_default
)
values (
  'Cliente Diversos',
  null,
  null,
  null,
  null,
  'Cliente padrao para vendas sem identificacao informada.',
  true
)
on conflict do nothing;

insert into public.settings (key, value)
values
  (
    'company',
    jsonb_build_object(
      'name', 'Veste Bem',
      'address', 'Shopping Via Norte - Rua 300 - Goiania',
      'whatsapp', '',
      'receipt_message', 'Obrigado pela preferencia.'
    )
  ),
  (
    'receipt',
    jsonb_build_object(
      'default_format', 'a4_third',
      'available_formats', jsonb_build_array('a4_third', 'thermal_80mm')
    )
  ),
  (
    'expense_categories',
    jsonb_build_array(
      'Mercadoria',
      'Aluguel',
      'Condominio',
      'Internet',
      'Embalagem',
      'Etiqueta',
      'Trafego pago',
      'Taxa de cartao',
      'Transporte',
      'Outros'
    )
  )
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

-- Primeiro administrador:
-- 1. Criar usuario manualmente no Supabase Auth.
-- 2. No SQL Editor do Supabase, inserir o registro correspondente em public.profiles
--    usando o id do auth.users, role = 'admin' e active = true.
--
-- Exemplo para revisao, nao executar sem substituir o UUID:
--
-- insert into public.profiles (id, name, role, active)
-- values ('00000000-0000-0000-0000-000000000000', 'Administrador', 'admin', true);
