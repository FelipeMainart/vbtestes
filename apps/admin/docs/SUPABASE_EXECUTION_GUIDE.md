# Guia de Execucao dos SQLs no Supabase

Este guia explica como executar manualmente os SQLs da FASE 3 no Supabase.

Importante: este projeto ainda nao executou nada automaticamente no Supabase. Os passos abaixo devem ser feitos manualmente pelo usuario no painel do Supabase.

## 1. Antes de comecar

Confirme que existem estes arquivos no projeto:

```text
database/sql/001_schema.sql
database/sql/002_rls.sql
database/sql/003_functions.sql
database/sql/004_views.sql
database/sql/005_seed.sql
```

Execute sempre um arquivo por vez, na ordem indicada neste guia.

## 2. Entrar no Supabase

1. Abra o navegador.
2. Acesse `https://supabase.com`.
3. Clique em `Sign in`.
4. Entre com sua conta.
5. Abra o projeto Supabase da Veste Bem.

Se ainda nao houver um projeto criado, crie um novo projeto antes de seguir. Guarde a senha do banco e espere o Supabase terminar a preparacao do projeto.

## 3. Abrir o SQL Editor

1. Dentro do projeto Supabase, veja o menu lateral esquerdo.
2. Clique em `SQL Editor`.
3. Clique em `New query` ou `Nova consulta`.
4. Apague qualquer texto que ja estiver no editor.

## 4. Ordem exata de execucao

Execute nesta ordem:

1. `database/sql/001_schema.sql`
2. `database/sql/002_rls.sql`
3. `database/sql/003_functions.sql`
4. `database/sql/004_views.sql`
5. `database/sql/005_seed.sql`

Nao pule arquivos. Nao execute fora de ordem.

## 5. Como executar cada arquivo

Para cada arquivo:

1. Abra o arquivo no seu editor.
2. Copie todo o conteudo do arquivo.
3. Cole no SQL Editor do Supabase.
4. Clique em `Run`.
5. Espere a execucao terminar.
6. Se nao houver erro, passe para o proximo arquivo.

Recomendacao: apos executar um arquivo com sucesso, limpe o SQL Editor antes de colar o proximo.

## 6. Como saber se deu certo

Quando a execucao funcionar, o Supabase normalmente mostra uma mensagem de sucesso, como `Success. No rows returned` ou uma mensagem parecida.

Depois de executar todos os arquivos, confirme:

1. No menu lateral, clique em `Table Editor`.
2. Verifique se aparecem tabelas como:
   - `profiles`
   - `customers`
   - `products`
   - `product_variations`
   - `sales`
   - `sale_items`
   - `orders`
   - `order_items`
   - `stock_movements`
   - `financial_entries`
   - `expenses`
   - `audit_logs`
   - `settings`

Tambem confirme no `SQL Editor` com consultas simples:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## 7. O que fazer se der erro

Se aparecer erro:

1. Pare imediatamente.
2. Nao execute os proximos arquivos.
3. Copie a mensagem completa do erro.
4. Anote qual arquivo estava sendo executado.
5. Informe o erro para revisao antes de tentar corrigir manualmente.

Erros comuns:

- Executar fora de ordem.
- Copiar apenas parte do arquivo.
- Colar dois arquivos juntos por engano.
- Projeto Supabase errado.
- Tabela, policy ou funcao criada parcialmente em tentativa anterior.

Se uma tentativa parcial aconteceu, nao tente apagar tabelas manualmente sem revisao.

## 8. Criar o primeiro usuario no Supabase Auth

Depois que os SQLs forem executados com sucesso:

1. No menu lateral do Supabase, clique em `Authentication`.
2. Clique em `Users`.
3. Clique em `Add user`.
4. Escolha `Create new user`.
5. Informe o e-mail do administrador.
6. Informe uma senha temporaria segura.
7. Confirme a criacao.

Depois disso, copie o `User UID` do usuario criado. Esse valor sera usado na tabela `profiles`.

## 9. Inserir o primeiro administrador em profiles

Com o `User UID` copiado, volte ao `SQL Editor`.

Cole este modelo, substituindo os valores:

```sql
insert into public.profiles (id, name, role, active)
values (
  'COLE_AQUI_O_USER_UID',
  'Administrador',
  'admin',
  true
);
```

Exemplo do que substituir:

- `COLE_AQUI_O_USER_UID`: o UUID do usuario criado em Authentication.
- `Administrador`: pode trocar pelo nome real da pessoa.

Depois clique em `Run`.

Para verificar:

```sql
select id, name, role, active
from public.profiles;
```

O usuario deve aparecer com:

- `role = admin`
- `active = true`

## 10. Verificar se Cliente Diversos foi criado

O arquivo `005_seed.sql` cria o cliente padrao `Cliente Diversos`.

Para verificar, rode:

```sql
select id, name, is_default
from public.customers
where is_default = true;
```

Resultado esperado:

- Deve aparecer um registro com `name = Cliente Diversos`.
- Deve aparecer `is_default = true`.

Se nao aparecer, pare e revise se o arquivo `005_seed.sql` foi executado.

## 11. Verificar se settings iniciais foram criadas

Rode:

```sql
select key, value
from public.settings
order by key;
```

Resultado esperado:

- `company`
- `expense_categories`
- `receipt`

## 12. Verificar funcoes principais

No SQL Editor, rode:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
order by routine_name;
```

Procure funcoes como:

- `create_sale_with_items`
- `cancel_sale`
- `admin_adjust_stock`
- `mark_order_paid`
- `update_order_status`
- `update_order_tracking`
- `cancel_order`
- `finalize_delivered_orders`

## 13. Verificar views

Rode:

```sql
select table_name
from information_schema.views
where table_schema = 'public'
order by table_name;
```

Procure views como:

- `vw_products_seller`
- `vw_stock_seller`
- `vw_sales_seller`
- `vw_orders_operational`
- `vw_dashboard_pending_orders`
- `vw_financial_summary_admin`

## 14. Depois da execucao

Quando tudo estiver correto:

1. Informe que os SQLs foram executados com sucesso.
2. Informe se o primeiro admin foi criado.
3. Informe se `Cliente Diversos` apareceu corretamente.
4. Aguarde a aprovacao para iniciar a FASE 4.

Nao iniciar a FASE 4 automaticamente.

