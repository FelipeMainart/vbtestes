# Auditoria de schema — preparação para comparação com o Supabase

Status: inventário local concluído em 15/07/2026. O diagnóstico geral ainda não foi formalmente reconciliado com um baseline. A migration 014 é a única exceção documentada: foi aplicada e validada em produção com Admin e Seller.

## Regras desta etapa

- Não executar migrations antes de extrair e preservar o estado real.
- Não assumir que os SQLs locais representam o banco implantado.
- Executar `database/diagnostics/compare_supabase_schema.sql` somente no SQL Editor e exportar todos os resultados.
- Não renomear, mover, consolidar ou reaplicar os arquivos atuais antes do baseline.

## 1. Inventário dos SQLs

| Nº | Arquivo | Objetivo e objetos principais | Dependências | Classificação / risco |
|---:|---|---|---|---|
| 001 | `001_schema.sql` | Base: 15 tabelas, extensão `pgcrypto`, PK/FK/checks e 11 índices | Auth do Supabase | Base definitiva pretendida; execução real a validar |
| 002 | `002_rls.sql` | Helpers de perfil, RLS das tabelas base, policies e grants/revokes | 001 | Definitivo pretendido; policies posteriores substituem partes |
| 003 | `003_functions.sql` | Helpers, `touch_updated_at`, 9 triggers e RPCs transacionais de estoque, vendas e pedidos | 001–002 | Definitivo e crítico; redefine helpers do 002 |
| 004 | `004_views.sql` | 6 views operacionais/seller/admin e grants | 001–003 | Parcialmente legado: views de produto/estoque são redefinidas depois |
| 005 | `005_seed.sql` | `Cliente Diversos` e settings iniciais | 001–004 | Seed idempotente pretendido; dados reais a validar |
| 006 | `006_product_colors_refactor.sql` | `product_colors`, FK nullable em variações, backfill, trigger, RLS e redefinição de 2 views | 001–005, `touch_updated_at` | Marcado como proposta, mas frontend depende dele; alta prioridade |
| 007 | `007_product_images_storage_policies.sql` | Bucket `product-images` e 3 policies de Storage | Helpers de admin do 002/003 | Definitivo pretendido; bucket/policies reais a validar |
| 008 | `008_customers_admin_delete_policy.sql` | DELETE de clientes somente para admin | 001–002 | Incremental definitivo pretendido |
| 009 | `009_edit_sale_transaction.sql` | RPC `edit_sale_with_items` transacional | Estrutura e RPCs 001–003 | Definitivo e usado pelo frontend |
| 010 | `010_finance_suppliers_expense_payments_proposal.sql` | `suppliers`; 6 colunas em `expenses`; índices, trigger e RLS | 001–003 | **Proposal usada pelo frontend**; possível drift crítico |
| 011 | `011_expense_transactions.sql` | RPCs `pay_expense` e `cancel_expense` | 010, financeiro e auditoria do 001/003 | Definitivo pretendido e usado pelo frontend; falha se 010 faltar |
| 012 | `012_company_assets_storage_policies.sql` | Bucket `company-assets` e 3 policies de Storage | Helpers de admin | Definitivo pretendido |
| 013 | `013_product_manual_sku.sql` | `products.sku`, índice parcial e redefinição de `vw_products_seller` | 006 | Definitivo e usado pelo frontend |
| 013 | `013_usernames_and_admin_users.sql` | `profiles.username/email/last_login_at`, constraint, índice e `record_profile_login` | 001–003, `auth.users` | Definitivo e usado por login/Edge Function; número duplicado |
| 014 | `014_secure_order_items_and_login_redirect.sql` | Policy admin em `order_items`, função operacional e view sem custos | 001–004 | Aplicada e validada; custos protegidos e redirect seguro confirmado |

### Ordem lógica local atual

`001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → ambos 013 → 014`.

Os dois arquivos 013 não têm dependência entre si, mas precisam receber identificadores únicos no futuro. Não devem ser renomeados antes de descobrir qual deles já foi aplicado.

## 2. Mapa consolidado do schema esperado

### Tabelas e colunas

Legenda: `PK`, `FK`, `UQ`, `NN` e `CK` representam chave primária, estrangeira, unicidade, obrigatório e check.

| Tabela | Colunas esperadas consolidadas | Origem |
|---|---|---|
| `profiles` | `id uuid PK/FK auth.users cascade`, `name text NN`, `role text NN CK admin/seller`, `active bool NN`, `created_at`, `updated_at`, `username text CK`, `email text`, `last_login_at timestamptz` | 001 + 013 users |
| `operation_sequence` | `id bigint identity PK`, `entity_type text NN CK sale/order`, `created_at` | 001 |
| `customers` | `id uuid PK`, `name NN`, `whatsapp`, `email`, `city`, `cpf`, `notes`, `is_default bool`, `created_by FK profiles`, timestamps | 001 |
| `products` | `id uuid PK`, `name NN`, `description`, `sale_price numeric CK`, `cost_price numeric CK`, `image_url`, `status CK`, `created_by FK`, timestamps, `sku text` | 001 + 013 SKU |
| `product_colors` | `id uuid PK`, `product_id FK`, `color_name NN`, `image_url`, `active`, timestamps; UQ `(product_id,color_name)` | 006 |
| `product_variations` | `id uuid PK`, `product_id FK`, `color`, `size`, `quantity CK`, `minimum_stock CK`, `status CK`, timestamps, `product_color_id FK nullable`; UQ legado `(product_id,color,size)` | 001 + 006 |
| `sales` | `id uuid PK`, `operation_number UQ`, `customer_id FK`, canal/pagamento, totais/custos, status, dados fiscais, notes, created/updated_by FKs, timestamps | 001 |
| `sale_items` | IDs/FKs de venda, produto e variação; snapshot de nome/cor/tamanho; quantidade, preço, custo, subtotal e custo total com checks | 001 |
| `orders` | IDs/operação/cliente; contato e CPF; totais; pagamento/status; endereço/envio; datas operacionais; timestamps | 001 |
| `order_items` | IDs/FKs; snapshot operacional; quantidade, preço, `unit_cost`, subtotal e `total_cost` | 001 |
| `order_tracking` | IDs/FK pedido; código/link/transportadora; datas de envio, previsão e entrega; timestamps | 001 |
| `stock_movements` | variação FK, tipo CK, quantidades CK, motivo/referência, autor FK e data | 001 |
| `financial_entries` | tipo/origem/status CK, categoria, descrição, valor, referência, autores FKs e timestamps | 001 |
| `expenses` | base financeira, método/data/notas/autores/deleted_at; mais `supplier_id`, `due_date`, `paid_at`, `paid_payment_method`, `payment_notes`, `status` | 001 + 010 |
| `suppliers` | cadastro, documento/contatos, autores FKs, timestamps e `deleted_at` | 010 |
| `audit_logs` | usuário/role, ação, módulo, entidade, before/after JSONB, IP, user-agent e data | 001 |
| `settings` | `id`, `key UQ`, `value jsonb`, `updated_by FK`, `updated_at` | 001 |

### Índices esperados

- Base: default único de clientes; produto de variações; cliente/operação de vendas e pedidos; itens por venda/pedido; movimentação por variação; referência financeira; entidade/data de auditoria.
- 006: `product_colors(product_id)` e `product_variations(product_color_id)`.
- 010: nome/documento de fornecedores e fornecedor/vencimento/status de despesas.
- 013 SKU: índice parcial `products(sku)`.
- 013 usuários: unique parcial em `lower(profiles.username)`.

### Views esperadas

| View | Versão final local | Uso/observação |
|---|---|---|
| `vw_products_seller` | 013 SKU | Produto ativo, agregados de cores/estoque e SKU, sem custo |
| `vw_stock_seller` | 006 | Estoque ativo com cor/imagem, sem custo |
| `vw_sales_seller` | 004 | Vendas sem custo/lucro |
| `vw_orders_operational` | 004 | Dados operacionais dos pedidos |
| `vw_dashboard_pending_orders` | 004 | Pendências e entregues recentes |
| `vw_financial_summary_admin` | 004 | Resumo mensal protegido por `is_admin()` |
| `order_items_seller_view` | 014 | Itens operacionais sem custos |

As views antigas não declaram `security_invoker`; a view 014 declara explicitamente. A configuração real de todas deve ser comparada.

### Functions/RPCs esperadas

- Autorização/helpers: `current_profile`, `is_active_user`, `is_admin`, `is_seller`, `touch_updated_at`.
- Internas: `create_audit_log`, `next_operation_number`, `adjust_stock`.
- Estoque: `admin_adjust_stock`.
- Vendas: `create_sale_with_items`, `edit_sale_with_items`, `cancel_sale`.
- Pedidos: `mark_order_paid`, `update_order_status`, `update_order_tracking`, `cancel_order`, `finalize_delivered_orders`.
- Financeiro: `pay_expense`, `cancel_expense`.
- Perfil: `record_profile_login`.
- Segurança 014: `get_order_items_operational`.

As funções críticas são `security definer` e devem ser comparadas por assinatura, corpo, proprietário, `search_path` e grants — não apenas pelo nome.

### Triggers esperados

`touch_updated_at` em `profiles`, `customers`, `products`, `product_variations`, `sales`, `orders`, `order_tracking`, `financial_entries`, `expenses`, além de `product_colors` (006) e `suppliers` (010).

### RLS e policies esperadas

- RLS nas 15 tabelas base, `product_colors` e `suppliers`.
- Admin: produtos, variações, financeiro, despesas, auditoria, settings e custos.
- Usuário ativo: clientes e visualização operacional de pedidos/rastreio/estoque.
- Seller: produtos/cores ativos por views/policies, vendas sem custos e itens de pedido pela view 014.
- 014 substitui `order_items_authenticated_select` por `order_items_admin_select`.
- Storage possui policies próprias em `storage.objects`.

### Storage esperado

| Bucket | Público | Policies locais |
|---|---:|---|
| `product-images` | sim | leitura pública; insert/update admin em `products/` |
| `company-assets` | sim | leitura pública; insert/update admin nos caminhos de logo |

Não há policy local de delete para esses buckets.

## 3. Dependências reais do frontend

| Objeto | Módulos/arquivos consumidores | Finalidade | Criticidade |
|---|---|---|---|
| `profiles` | auth, permissions, settings, reports, audit, stock | sessão, roles, usuários e nomes de autores | Crítica |
| `customers` | app, customers, dashboard, orders, reports, sales | CRUD, busca e vínculo operacional | Crítica |
| `products`, `product_colors`, `product_variations` | products, stock, sales | catálogo administrativo, cores, variações e estoque | Crítica |
| `vw_products_seller`, `vw_stock_seller` | app, dashboard, products, reports, sales, stock | acesso operacional sem custo | Crítica |
| `sales`, `sale_items`, `vw_sales_seller` | customers, dashboard, finance, products, reports, sales | vendas, métricas, relatórios e recibos | Crítica |
| `create_sale_with_items`, `edit_sale_with_items`, `cancel_sale` | sales | transações oficiais de venda | Crítica |
| `orders`, `order_items`, `order_items_seller_view`, `order_tracking` | app, customers, dashboard, finance, orders, reports | operação e acompanhamento de pedidos | Crítica |
| RPCs de pedido | orders | pagamento, status, rastreio, cancelamento e finalização | Crítica |
| `financial_entries`, `expenses`, `suppliers` | dashboard, finance, reports | indicadores e operação financeira | Crítica para admin |
| `pay_expense`, `cancel_expense` | finance | baixa/cancelamento transacional | Crítica para admin |
| `stock_movements`, `admin_adjust_stock` | stock | histórico e ajuste manual | Alta |
| `audit_logs` | audit, sales | auditoria e justificativas | Alta |
| `settings` | dashboard, finance, sales, settings | empresa, metas e recibos | Alta |
| `record_profile_login` | auth | grava último login | Alta |
| Edge Function `admin-users` | settings | criação, atualização e senha de usuários | Alta; não é objeto SQL |

Objetos locais sem uso direto identificado no frontend: `operation_sequence`, helpers internos e `vw_dashboard_pending_orders`/`vw_financial_summary_admin`. Eles são utilizados internamente ou representam APIs previstas.

## 4. Checklist da comparação real

| Objeto esperado | Definido em | Existe no real | Está igual | Divergência | Ação futura | Prioridade |
|---|---|---|---|---|---|---|
| 15 tabelas base e constraints | 001 | A validar | A validar | A validar | Comparar catálogo | Crítica |
| Helpers/RLS/grants base | 002–003 | A validar | A validar | A validar | Comparar corpo, roles e grants | Crítica |
| RPCs transacionais de vendas | 003 + 009 | A validar | A validar | A validar | Teste de assinatura e transação | Crítica |
| Estrutura/RPCs de Pedidos | 001 + 003 | A validar | A validar | A validar | Validar tabelas, checks e funções | Crítica |
| Views seller/operacionais | 004 + 006 + 013 + 014 | A validar | A validar | A validar | Comparar definição e segurança | Crítica |
| Seed Cliente Diversos/settings | 005 | A validar | A validar | A validar | Conferir dados, sem reaplicar cegamente | Alta |
| `product_colors` e FK/backfill | 006 | A validar | A validar | A validar | Conferir órfãos e views finais | Crítica |
| Bucket/policies `product-images` | 007 | A validar | A validar | A validar | Comparar bucket e policies | Alta |
| Delete admin de clientes | 008 | A validar | A validar | A validar | Testar admin/seller | Alta |
| `suppliers` e expansão de despesas | 010 proposal | A validar | A validar | A validar | Confirmar antes do financeiro | Crítica |
| `pay_expense`/`cancel_expense` | 011 | A validar | A validar | A validar | Confirmar dependência 010 | Crítica |
| Bucket/policies `company-assets` | 012 | A validar | A validar | A validar | Comparar bucket e policies | Alta |
| `products.sku` e view final | 013 SKU | A validar | A validar | A validar | Identificar aplicação do 013 | Alta |
| `username/email/last_login_at` | 013 users | A validar | A validar | A validar | Confirmar login e Edge Function | Crítica |
| `record_profile_login` | 013 users | A validar | A validar | A validar | Comparar assinatura/grant | Crítica |
| Segurança de `order_items` | 014 | Sim, validada | Sim para o escopo da 014 | Policy antiga removida; tabela restrita a Admin; Seller usa view sem custos | Preservar no futuro baseline | Concluída |
| Redirect seguro do login | Código da v1.0 + 014 como marco de segurança | Sim, validado | Sim | Redirect externo rejeitado e rotas internas permitidas | Manter testes de regressão | Concluída |
| `PROJECT_STATUS.md` | documentação | Local existe | Atualizado para v1.0 | Nenhuma no fechamento documental | Manter a cada release | Baixa |

## 5. Riscos já identificados

1. Dois arquivos `013` impedem uma ordem histórica inequívoca.
2. O Financeiro depende em produção lógica de um arquivo rotulado `proposal`.
3. A migration 011 pressupõe que a 010 esteja aplicada.
4. As redefinições sucessivas de views tornam a ordem de execução relevante.
5. 006 também é chamada de proposta, mas Produtos/Vendas/Estoque dependem de `product_colors` e das views novas.
6. O schema completo ainda não possui baseline formal, apesar da 014 estar aplicada e validada.
7. Os SQLs não possuem tabela local de histórico/checksum de aplicação.
8. A 014 deve constar no futuro baseline como aplicada, sem ser executada novamente no banco de produção.
9. Comparar apenas nomes é insuficiente para functions `security definer` e policies.
10. A integração futura de pedidos precisa de criação idempotente e reserva transacional de estoque.
11. Pagamentos Pix e webhooks ainda precisam de identificadores externos, validação de assinatura, idempotência e histórico de processamento.

## 6. Estratégia futura de organização

### Próximo número

O próximo número livre é `015`. Não criar 015 corretiva antes de concluir a comparação.

### Duplicidade 013

1. Descobrir no banco quais objetos de cada 013 existem.
2. Registrar checksums dos arquivos originais.
3. Não renomear arquivos possivelmente já aplicados.
4. No novo histórico, atribuir IDs cronológicos únicos e manter uma tabela de equivalência para os nomes legados.

### Proposals

- Classificar 006 e 010 pelo estado real: não aplicada, parcial ou integral.
- Se integral, registrá-la no baseline como aplicada sem reexecutar.
- Se parcial, criar futuramente uma migration incremental idempotente baseada na divergência real.
- Nunca executar o arquivo proposal completo apenas porque algum objeto está ausente.

### Baseline e migração para `supabase/migrations`

1. Congelar backup lógico e exportar o diagnóstico.
2. Gerar snapshot declarativo do schema real.
3. Revisar manualmente objetos gerenciados pelo Supabase Auth/Storage.
4. Criar um baseline versionado que represente o estado real, sem aplicá-lo sobre o próprio ambiente.
5. Registrar migrations legadas como reconciliadas, com nome, checksum, data conhecida/estimada e evidência.
6. A partir do baseline, usar timestamps únicos em `supabase/migrations`.
7. Aplicar mudanças futuras primeiro em ambiente de homologação.
8. Usar diff pós-migration e tabela de histórico para impedir dupla execução.

## 7. Ordem recomendada da comparação futura

1. Fazer backup e registrar versão PostgreSQL/Supabase.
2. Executar o script diagnóstico somente leitura e exportar cada resultado.
3. Comparar tabelas/colunas/constraints/FKs.
4. Comparar índices e triggers.
5. Comparar functions por assinatura, corpo, proprietário, `security_definer`, `search_path` e grants.
6. Comparar views pela definição final efetiva.
7. Comparar RLS, policies e grants usando usuários admin, seller e anon.
8. Comparar buckets e policies de Storage.
9. Priorizar objetos usados pelo frontend, especialmente 006, 010, ambos 013 e 014.
10. Classificar cada divergência como ausente, parcial, diferente ou extra no banco.
11. Só então planejar migrations incrementais; nunca reaplicar a sequência inteira no banco real.
