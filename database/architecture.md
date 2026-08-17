# Arquitetura atual do banco de dados — Veste Bem ERP e Site

> Levantamento estático realizado em 06/08/2026. Nenhuma consulta foi executada contra o Supabase. Este documento descreve o **estado esperado pelo repositório**, indicando separadamente o que não pôde ser confirmado no banco implantado.

## Índice

1. [Escopo, fontes e nível de confiança](#1-escopo-fontes-e-nível-de-confiança)
2. [Visão geral](#2-visão-geral)
3. [Modelo relacional](#3-modelo-relacional)
4. [Catálogo e estoque](#4-catálogo-e-estoque)
5. [Vendas e pedidos](#5-vendas-e-pedidos)
6. [Clientes, financeiro e administração](#6-clientes-financeiro-e-administração)
7. [Views](#7-views)
8. [Funções, triggers e transações](#8-funções-triggers-e-transações)
9. [RLS, permissões e Storage](#9-rls-permissões-e-storage)
10. [Fluxos de dados](#10-fluxos-de-dados)
11. [Arquitetura do Site](#11-arquitetura-do-site)
12. [Oportunidades de melhoria](#12-oportunidades-de-melhoria)
13. [Lacunas e informações não determinadas](#13-lacunas-e-informações-não-determinadas)
14. [Resumo final](#14-resumo-final)
15. [Arquitetura Oficial V1](#arquitetura-oficial-v1)
16. [Próximas Sprints](#próximas-sprints)

# Arquitetura Oficial V1

Esta seção representa a arquitetura oficialmente aprovada do projeto e deve servir como referência normativa para todas as próximas sprints. Nenhuma implementação futura deverá contrariar estas definições sem uma revisão explícita da arquitetura.

## Visão oficial

```text
                     ERP (ADMIN)

products
     │
     ├──────────────► product_colors
     │                     │
     │                     ├── imagem principal da cor
     │                     └── informações da cor
     │
     └──────────────► product_variations
                           │
                           └── estoque / tamanhos

────────────────────────────────────────────

                CAMADA PÚBLICA

           vw_site_products
                   │
                   ▼

                SITE

        ├── product_colors
        │
        ├── site_product_settings
        │
        └── site_product_media
                │
                ▼
        Supabase Storage
```

## Responsabilidades oficiais

### ERP

O ERP é responsável por:

- produtos;
- estoque;
- preços;
- SKU;
- cores;
- tamanhos;
- imagem principal da cor.

### Site

O Site é responsável por:

- publicação;
- destaque;
- SEO;
- galeria complementar;
- ordem das imagens.

### Storage

O Supabase Storage é responsável por:

- imagens do ERP;
- imagens complementares do Site.

As duas categorias de imagens utilizarão um único bucket. A separação de responsabilidade deverá ser preservada pela organização dos caminhos, pelos metadados e pelas políticas de acesso definidas nas sprints futuras.

## Decisões oficiais

1. O Site nunca altera dados comerciais do ERP.
2. O ERP continua sendo a fonte da verdade.
3. A imagem principal da cor pertence ao ERP.
4. A galeria complementar pertence ao Site.
5. `site_product_media` se relaciona com `product_colors` por `product_color_id`.
6. `site_product_settings` se relaciona com `products` por `product_id`.
7. O Site consome:
   - `vw_site_products`;
   - `product_colors`.
8. Não será criada uma `vw_site_product_colors` nesta versão.

A decisão de consumir `product_colors` sem uma view pública específica foi tomada por simplicidade arquitetural. Ela poderá ser revista futuramente caso existam novos consumidores além do Site.

## 1. Escopo, fontes e nível de confiança

Foram analisados o schema SQL base, os incrementos `002` a `014`, diagnósticos, documentação arquitetural, módulos JavaScript do Admin, Edge Function de usuários e o repository do Site.

Há uma ressalva essencial: `apps/admin/DATABASE_SCHEMA_AUDIT.md` declara que o inventário local **não foi reconciliado com um baseline do Supabase**. Apenas `014_secure_order_items_and_login_redirect.sql` está explicitamente registrado como aplicado e validado em produção. Os arquivos `006` e `010` são chamados de proposta, embora o frontend dependa dos objetos que eles definem. Portanto:

- **Confirmado no código:** consultas, payloads e RPCs que as aplicações tentam usar.
- **Esperado pelos SQLs:** tabelas, campos, constraints, views, funções, grants e policies descritos abaixo.
- **Confirmado no banco:** somente o que a auditoria local afirma expressamente sobre o incremento 014.
- **Não confirmado:** presença e definição exatas dos demais objetos no Supabase real.

## 2. Visão geral

O Admin é um frontend estático que usa o SDK oficial do Supabase no navegador com chave anônima, sessão do Supabase Auth, RLS e RPCs `security definer`. Administradores acessam tabelas completas; vendedores usam principalmente views sem custos. O Site usa um cliente Supabase server-side e consulta `public.vw_site_products` por um repository próprio.

```text
Supabase Auth
    │ 1:1
    ▼
 profiles ───────────────► auditoria/autoria

 products
    ├──► product_colors
    │       ├──► product_variations ───► stock_movements
    │       │          ├──► sale_items ───► sales ───► financial_entries
    │       │          └──► order_items ──► orders ──► financial_entries
    │       │                                    └──► order_tracking
    │       └──► site_product_media (planejada: galeria complementar por cor)
    └──► vw_site_products ───► Site (leitura pública projetada)

 customers ───► sales
     └────────► orders

 suppliers ───► expenses ───► financial_entries
 settings ───► configuração da empresa/recibos
 audit_logs ◄── RPCs controladas
```

## 3. Modelo relacional

### 3.1 Convenções gerais

- IDs de negócio usam `uuid`, normalmente com `gen_random_uuid()`.
- Valores monetários usam `numeric(10,2)` no ERP; o Site converte `sale_price` para centavos.
- Status são textos com `check`, em inglês e `snake_case`.
- `created_at` normalmente usa `now()`; `updated_at` é atualizado pelo trigger `touch_updated_at` quando configurado.
- A maioria das FKs não declara `ON DELETE`; portanto, o comportamento esperado é `NO ACTION`. A exceção explícita é `profiles.id → auth.users.id ON DELETE CASCADE`.
- Exclusões físicas são evitadas para entidades históricas; produtos, cores e variações são inativados.

## 4. Catálogo e estoque

### 4.1 `products`

**Objetivo:** entidade comercial principal do catálogo, administrada pelo ERP.

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | uuid | não | PK; `gen_random_uuid()` | Identidade usada por cores, variações e itens históricos. |
| `name` | text | não | — | Nome comercial. |
| `description` | text | sim | — | O Site normaliza `NULL` para `""`. |
| `sale_price` | numeric(10,2) | não | `0` | `>= 0`; preço público. |
| `cost_price` | numeric(10,2) | não | `0` | `>= 0`; sensível, somente ERP/admin. |
| `image_url` | text | sim | — | Imagem genérica legada do produto. |
| `status` | text | não | `'active'` | `active` ou `inactive`; controla disponibilidade comercial. |
| `created_by` | uuid | sim | FK `profiles.id` | Autor administrativo. |
| `created_at` | timestamptz | não | `now()` | Criação. |
| `updated_at` | timestamptz | não | `now()` | Atualizado por trigger. |
| `sku` | text | sim | — | Adicionado pelo SQL 013; índice parcial, mas sem unicidade declarada. |

**Relacionamentos:** 1:N com `product_colors` e `product_variations`; referenciado por `sale_items` e `order_items`. `created_by` liga a `profiles`.

**Quem usa:** Produtos, Estoque, Vendas/POS, Dashboard e Relatórios. O Site consome uma projeção da entidade por `vw_site_products`.

**Fluxo:** admin cria/atualiza diretamente pelo módulo Produtos; o status é alternado na própria tabela. Vendas e pedidos consultam produto ativo. Nome, preço e custo são copiados para itens históricos no momento da transação.

### 4.2 `product_colors`

**Objetivo:** representar uma cor pertencente a um produto e armazenar a imagem compartilhada por todos os tamanhos dessa cor.

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | uuid | não | PK; `gen_random_uuid()` | Identidade da cor do produto. |
| `product_id` | uuid | não | FK `products.id` | Produto proprietário. |
| `color_name` | text | não | UQ com `product_id` | Nome exibido da cor. |
| `image_url` | text | sim | — | URL pública no bucket `product-images`. |
| `active` | boolean | não | `true` | Inativação lógica. |
| `created_at` | timestamptz | não | `now()` | Criação. |
| `updated_at` | timestamptz | não | `now()` | Atualizado por trigger. |

**Relacionamentos:** N:1 com `products`; 1:N lógico com `product_variations` por `product_color_id`; futuramente 1:N com `site_product_media`, também por `product_color_id`.

**Quem usa:** Produtos, Estoque, Vendas/POS, views de vendedor e futuro Site com escolha de cor.

**Fluxo:** no formulário de produto, o Admin converte a imagem para WebP, envia para `product-images/products/{productId}/colors/{slug}.webp`, obtém URL pública e então insere/atualiza `product_colors`. Essa imagem continua sendo a imagem principal da cor sob responsabilidade do ERP. Cores não devem ser apagadas; `active=false` as retira da operação. A galeria complementar do e-commerce será responsabilidade do Site e pertencerá diretamente à cor.

### 4.3 `product_variations`

**Objetivo:** representar a combinação vendável de cor e tamanho e manter o saldo atual de estoque.

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | uuid | não | PK; `gen_random_uuid()` | Identidade usada em venda, pedido e estoque. |
| `product_id` | uuid | não | FK `products.id` | Relação direta mantida por compatibilidade/performance. |
| `color` | text | não | UQ legado | Texto legado da cor. |
| `size` | text | não | UQ legado | Tamanho. |
| `quantity` | integer | não | `0` | Saldo atual; `>= 0`. |
| `minimum_stock` | integer | não | `0` | Limite de estoque baixo; `>= 0`. |
| `status` | text | não | `'active'` | `active` ou `inactive`. |
| `created_at` | timestamptz | não | `now()` | Criação. |
| `updated_at` | timestamptz | não | `now()` | Atualizado por trigger. |
| `product_color_id` | uuid | sim | FK `product_colors.id` | Adicionado pelo SQL 006; permanece nullable. |

Constraint legada: `unique(product_id, color, size)`. A unicidade desejada `(product_color_id, size)` não foi aplicada no SQL versionado.

**Relacionamentos:** N:1 com produto e cor; 1:N com `stock_movements`, `sale_items` e `order_items`.

**Quem usa:** Produtos, Estoque, Vendas, Pedidos, Dashboard e Relatórios.

**Fluxo:** o formulário cria as combinações cor × tamanho depois de salvar produto e cores. Ajustes manuais passam por `admin_adjust_stock`; vendas e pedidos alteram saldo via RPCs transacionais. A coluna `quantity` é o saldo corrente e `stock_movements` é o razão histórico.

### 4.4 `stock_movements`

**Objetivo:** razão imutável das alterações de estoque.

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | uuid | não | PK; `gen_random_uuid()` | — |
| `variation_id` | uuid | não | FK `product_variations.id` | Variação movimentada. |
| `movement_type` | text | não | check | `entry`, `exit`, `adjustment`, `sale`, `order`, `cancel_sale`, `cancel_order`. |
| `quantity` | integer | não | — | Quantidade positiva da operação. |
| `previous_quantity` | integer | não | — | Saldo anterior. |
| `new_quantity` | integer | não | — | Saldo posterior. |
| `reason` | text | sim | — | Obrigatório pelo fluxo para ajuste manual. |
| `reference_type` | text | sim | check | `sale`, `order` ou `manual`. |
| `reference_id` | uuid | sim | relação lógica | Não é FK física. |
| `created_by` | uuid | sim | FK `profiles.id` | Autor. |
| `created_at` | timestamptz | não | `now()` | — |

**Quem usa e fluxo:** Estoque consulta o histórico; `adjust_stock` cria registros durante venda, pedido, cancelamento e ajuste. Não há escrita direta pretendida pelo frontend.

### 4.5 Como produto, cor, estoque, SKU e imagem funcionam

```text
1. Admin envia dados básicos
   └─ INSERT/UPDATE products
      ├─ sku manual (pode ser NULL; não há UQ no SQL)
      ├─ status comercial
      ├─ sale_price / cost_price
      └─ description

2. Para cada cor
   ├─ imagem → WebP no navegador
   ├─ upload com upsert no bucket público product-images
   └─ INSERT/UPDATE product_colors com image_url

3. Para cada cor × tamanho novo
   └─ INSERT product_variations
      ├─ product_id
      ├─ product_color_id
      ├─ color (legado duplicado)
      ├─ size
      └─ quantity / minimum_stock

4. Alterações posteriores de saldo
   └─ RPC adjust_stock/admin_adjust_stock
      ├─ atualiza product_variations.quantity
      └─ insere stock_movements
```

O SKU é informado manualmente no formulário. O SQL cria apenas índice parcial, não `UNIQUE`; portanto duplicidade é tecnicamente possível. As imagens por cor ficam em Storage e suas URLs ficam em `product_colors.image_url`. `products.image_url` é um campo genérico/legado ainda consultado em alguns fluxos. Status são controlados em três níveis independentes: `products.status`, `product_colors.active` e `product_variations.status`.

## 5. Vendas e pedidos

### 5.1 `operation_sequence`

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | bigint | não | identity PK | Número entregue a venda/pedido. |
| `entity_type` | text | não | check | `sale` ou `order`. |
| `created_at` | timestamptz | não | `now()` | — |

Manipulada por `next_operation_number`; não deve ser escrita diretamente. O mesmo identity gera numeração global, embora `entity_type` registre o domínio.

### 5.2 `sales`

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | uuid | não | PK | `gen_random_uuid()`. |
| `operation_number` | bigint | não | UQ | Gerado por `operation_sequence`. |
| `customer_id` | uuid | não | FK `customers.id` | Cliente ou cliente padrão. |
| `channel` | text | não | check | `physical_store`, `whatsapp`, `instagram`, `site`. |
| `payment_method` | text | não | check | `pix`, `cash`, `card`. |
| `gross_total`, `discount`, `net_total` | numeric(10,2) | não | `0`; checks | Valores comerciais. |
| `total_cost`, `estimated_gross_profit` | numeric(10,2) | não | `0` | Sensíveis. |
| `status` | text | não | `'completed'` | `completed`/`cancelled`. |
| `invoice_requested` | boolean | não | `false` | — |
| `invoice_number` | text | sim | — | — |
| `invoice_status` | text | não | `'none'` | `none`, `pending`, `issued`. |
| `notes` | text | sim | — | — |
| `created_by`, `updated_by` | uuid | sim | FK `profiles.id` | Autoria. |
| `created_at`, `updated_at` | timestamptz | não | `now()` | — |
| `cancelled_at` | timestamptz | sim | — | — |

**Uso/fluxo:** Vendas cria por `create_sale_with_items`, edita por `edit_sale_with_items` e cancela por `cancel_sale`. Dashboard, Produtos, Clientes e Relatórios consultam. A transação movimenta estoque, financeiro e auditoria.

### 5.3 `sale_items`

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | uuid | não | PK | — |
| `sale_id` | uuid | não | FK `sales.id` | Sem cascade explícito. |
| `product_id` | uuid | não | FK `products.id` | Rastreabilidade. |
| `variation_id` | uuid | não | FK `product_variations.id` | — |
| `product_name`, `color`, `size` | text | não | — | Snapshot histórico. |
| `quantity` | integer | não | check `> 0` | — |
| `unit_price`, `unit_cost`, `subtotal`, `total_cost` | numeric(10,2) | não | checks `>= 0` | Custos são sensíveis. |

Criada e substituída apenas pelas RPCs de venda. Consultada por Vendas, Produtos, Dashboard e Relatórios.

### 5.4 `orders`

| Grupo | Campos | Nulo/default | Observações |
|---|---|---|---|
| Identidade | `id` uuid PK, `operation_number` bigint UQ, `origin` text | `origin='site'` | Origem aceita somente `site`. |
| Cliente | `customer_id` FK, `customer_whatsapp`, `customer_email`, `customer_cpf` | contato nullable | Cliente + snapshots. |
| Valores | `products_total`, `discount`, `shipping_value`, `total` numeric | não; `0` | Checks não negativos. |
| Pagamento | `payment_method`, `payment_status` | método nullable; status `'pending'` | Status: pending/paid/cancelled/refunded. |
| Operação | `order_status` | `'awaiting_payment'` | paid, in_separation, awaiting_shipping, shipped, delivered, finalized, cancelled. |
| Endereço | `postal_code`, `street`, `number`, `complement`, `neighborhood`, `city`, `state` | sim | Dados pessoais. |
| Entrega | `shipping_method`, `carrier`, `estimated_deadline` | sim | — |
| Interno | `internal_notes` | sim | Nunca público. |
| Datas | `paid_at`, `delivered_at`, `finalized_at`, `cancelled_at` | sim | Marcos operacionais. |
| Auditoria temporal | `created_at`, `updated_at` | `now()` | — |

**Uso/fluxo:** pedidos são consultados por Pedidos, Dashboard, Financeiro e Relatórios. O SQL prevê criação futura pelo Site via função/Edge Function/service role; não há fluxo versionado de criação. Admin marca pagamento/cancela; usuário ativo atualiza status e rastreio via RPCs.

### 5.5 `order_items`

Mesmos campos estruturais de `sale_items`, trocando `sale_id` por `order_id` FK. Contém `unit_cost` e `total_cost`, mas o incremento 014 restringe a tabela completa a admin e oferece `order_items_seller_view` sem custos para vendedor. É criado pelo futuro fluxo de pedido do Site; a implementação de criação não está no repositório.

### 5.6 `order_tracking`

| Campo | Tipo | Nulo | Chave/default |
|---|---|---:|---|
| `id` | uuid | não | PK; `gen_random_uuid()` |
| `order_id` | uuid | não | FK `orders.id` |
| `tracking_code`, `tracking_link`, `carrier` | text | sim | — |
| `shipped_at` | timestamptz | sim | — |
| `estimated_delivery_date` | date | sim | — |
| `delivered_at` | timestamptz | sim | — |
| `created_at`, `updated_at` | timestamptz | não | `now()` |

Pedidos consulta; `update_order_tracking` cria ou atualiza o registro mais recente e registra auditoria.

## 6. Clientes, financeiro e administração

### 6.1 `profiles`

| Campo | Tipo | Nulo | Chave/default | Observações |
|---|---|---:|---|---|
| `id` | uuid | não | PK/FK `auth.users.id`; cascade | Identidade 1:1. |
| `name` | text | não | — | — |
| `role` | text | não | check | `admin` ou `seller`. |
| `active` | boolean | não | `true` | Bloqueio operacional. |
| `created_at`, `updated_at` | timestamptz | não | `now()` | — |
| `username` | text | sim | unique parcial em `lower()` | Formato validado por check. |
| `email` | text | sim | — | Copiado de Auth. |
| `last_login_at` | timestamptz | sim | — | Atualizado por RPC. |

Auth/Login, Configurações de usuários, permissões e autoria em todo o ERP. A Edge Function `admin-users` cria usuário em Auth e faz upsert do profile; atualiza perfil, bloqueio e senha.

### 6.2 `customers`

`id uuid PK default`, `name text NOT NULL`, `whatsapp/email/city/cpf/notes text NULL`, `is_default boolean NOT NULL default false`, `created_by uuid FK profiles NULL`, timestamps não nulos. Índice único parcial permite um cliente padrão.

Clientes cria/edita e admin pode excluir conforme policy 008; Vendas usa o cliente padrão quando nenhum é escolhido. Vendas, Pedidos, Dashboard e Relatórios consultam. Antes de excluir, o frontend verifica referências em `sales` e `orders`.

### 6.3 `financial_entries`

`id uuid PK`; `type` (`income|expense|reversal`), `origin` (`automatic|manual`), `category` obrigatórios; `description` nullable; `amount numeric(10,2) >= 0`; `status active|cancelled`; `reference_type sale|order|expense` e `reference_id` como relação polimórfica lógica; `created_by/updated_by` FKs; timestamps.

Financeiro, Dashboard e Relatórios consultam. RPCs de venda, pedido e despesa criam/atualizam/cancelam lançamentos. Admin também pode criar lançamentos manuais. Não há FK física para `reference_id`.

### 6.4 `expenses`

Base: `id` PK, `financial_entry_id` FK nullable, `category` obrigatório, `description` nullable, `amount` não negativo, `payment_method` opcional, `expense_date default current_date`, `notes`, autoria, timestamps e `deleted_at`.

Incremento 010 esperado: `supplier_id` FK nullable, `due_date`, `paid_at`, `paid_payment_method`, `payment_notes` e `status pending|paid|cancelled default pending`.

Financeiro/Dashboard/Relatórios usam. Admin cria; `pay_expense` dá baixa e sincroniza `financial_entries`; `cancel_expense` cancela ambos e audita. O módulo ainda contém caminhos diretos de insert/update além das RPCs.

### 6.5 `suppliers`

`id uuid PK default`, `name NOT NULL`, `document`, `whatsapp`, `email`, `city`, `notes`, `created_by/updated_by` FKs, timestamps e `deleted_at`. Criada pelo SQL 010, marcado como proposta mas usado pelo módulo Financeiro, Dashboard e Relatórios. Admin cria/edita; não há policy de delete.

### 6.6 `audit_logs`

`id uuid PK`, `user_id` FK nullable, `user_role`, `action NOT NULL`, `module NOT NULL`, `entity_type`, `entity_id`, `before_data/after_data jsonb`, `ip_address`, `user_agent`, `created_at default now()`.

RPCs controladas escrevem via `create_audit_log`; Audit, Vendas e admin consultam. Não há FK polimórfica para `entity_id`, nem insert direto pretendido para usuários autenticados.

### 6.7 `settings`

`id uuid PK`, `key text NOT NULL UNIQUE`, `value jsonb`, `updated_by` FK nullable e `updated_at default now()`. Configurações administra; Dashboard, Vendas e Financeiro consultam `company`; seed inclui `company`, `receipt` e `expense_categories`. A logo fica no Storage, enquanto a URL/configuração fica no JSON de `settings`.

## 7. Views

| View | Fonte | Exposição/consumidor |
|---|---|---|
| `vw_products_seller` | products + agregados de colors/variations | Produto ativo, SKU, imagens por cor e estoque agregado, sem custo; Produtos, Estoque, Vendas, Dashboard. |
| `vw_stock_seller` | variations + products + colors | Estoque ativo, status calculado e imagem da cor, sem custos; Estoque, Dashboard, Relatórios, Vendas. |
| `vw_sales_seller` | sales + customers | Venda sem custo/lucro; Vendas, Dashboard, Produtos e Relatórios. |
| `vw_orders_operational` | orders + customers | Pedido operacional; módulos do Admin. |
| `vw_dashboard_pending_orders` | `vw_orders_operational` | Pendentes e entregues recentes. |
| `vw_financial_summary_admin` | financial_entries | Resumo mensal condicionado a `is_admin()`. |
| `order_items_seller_view` | RPC `get_order_items_operational` | Itens de pedido sem custos; incremento 014 confirmado. |
| `vw_site_products` | não versionada nos SQLs analisados | Site consulta `id, sku, name, description, sale_price, image_url, status`; existência informada pelo código/contexto, definição real não auditada. |

As views antigas do Admin não declaram `security_invoker`; apenas `order_items_seller_view` o faz explicitamente. Grants permitem leitura a `authenticated`, nunca a `anon` nos SQLs do Admin. A política/grant real de `vw_site_products` não pôde ser determinada.

## 8. Funções, triggers e transações

| Grupo | Funções | Responsabilidade |
|---|---|---|
| Identidade | `current_profile`, `is_active_user`, `is_admin`, `is_seller`, `record_profile_login` | Perfil, autorização e último login. |
| Infraestrutura | `touch_updated_at`, `create_audit_log`, `next_operation_number` | Timestamps, auditoria e numeração. |
| Estoque | `adjust_stock`, `admin_adjust_stock` | Saldo + movimento atômico; ajuste manual somente admin. |
| Vendas | `create_sale_with_items`, `edit_sale_with_items`, `cancel_sale` | Venda, itens, estoque, financeiro e auditoria em transação. |
| Pedidos | `mark_order_paid`, `update_order_status`, `update_order_tracking`, `cancel_order`, `finalize_delivered_orders` | Ciclo operacional, estoque, financeiro e auditoria. |
| Despesas | `pay_expense`, `cancel_expense` | Baixa/cancelamento sincronizados com financeiro. |
| Segurança | `get_order_items_operational` | Projeção de itens sem custos para usuário ativo. |

Triggers `touch_updated_at` são esperados em profiles, customers, products, product_variations, product_colors, sales, orders, order_tracking, financial_entries, expenses e suppliers. Não há trigger equivalente documentado para `settings`, embora possua `updated_at`.

## 9. RLS, permissões e Storage

### 9.1 Modelo de acesso

- `admin`: produtos, cores, variações, financeiro, despesas, configurações e auditoria.
- `seller`: clientes, vendas via RPC, pedidos/estoque operacionais e views sem custos.
- `anon`: os SQLs do Admin revogam acesso às tabelas críticas; Storage de imagens/logos é público para leitura.
- Funções críticas são `security definer`, com execução concedida seletivamente a `authenticated`.

RLS é esperado em todas as tabelas operacionais. Produtos e variações têm policy `admin all`; vendedores obtêm projeções por views. `product_colors` permite leitura ativa ao seller e escrita ao admin. `order_items` foi endurecida no 014: tabela completa só para admin e view operacional para seller.

### 9.2 Storage

| Bucket | Público | Caminho usado | Escrita |
|---|---:|---|---|
| `product-images` | sim | `products/{productId}/colors/{slug}.webp` | Admin insert/update; sem delete. |
| `company-assets` | sim | `company/logo/{arquivo}` | Admin insert/update; sem delete. |

URLs das imagens principais das cores são persistidas em `product_colors.image_url` e continuam sob responsabilidade do ERP. O caminho usa slug do nome da cor, embora a proposta arquitetural antiga recomende ID da cor; renomear uma cor pode deixar arquivo anterior sem referência. A futura galeria complementar do Site será armazenada e ordenada separadamente por cor em `site_product_media`.

## 10. Fluxos de dados

### 10.1 Venda

```text
Vendas/POS → create_sale_with_items
  → operation_sequence
  → sales + sale_items (snapshots)
  → adjust_stock → product_variations + stock_movements
  → financial_entries (receita)
  → audit_logs
```

### 10.2 Pedido

```text
Site (criação ainda não implementada/versionada)
  → orders + order_items
Admin marca pagamento → mark_order_paid
  → baixa estoque
  → financial_entries
  → audit_logs
Operação → status/rastreio → order_tracking
```

### 10.3 Despesa

```text
Financeiro → expenses [→ suppliers]
  → pay_expense → financial_entries ativo
  → cancel_expense → expense + lançamento cancelados
  → audit_logs
```

## 11. Arquitetura do Site

### 11.1 O que deve consumir

O Site deve consumir **uma view pública dedicada por meio de um repository server-side**, não a tabela `products` diretamente. A divisão correta é:

```text
ERP tables → public.vw_site_products → SupabaseProductRepository → ProductService → páginas/componentes
```

Isso já está parcialmente implementado: `SupabaseProductRepository` consulta `vw_site_products`, valida com Zod e converte `sku → reference`, `sale_price → priceInCents` e `description NULL → ""`.

### 11.2 Informações já existentes

- Em `products`: ID, SKU, nome, descrição, preço de venda, imagem genérica e status.
- Em `product_colors`: cores ativas e imagem por cor.
- Em `product_variations`: tamanho, disponibilidade operacional e saldo.
- Em views do Admin: agregados de cores, imagens, variações e estoque, mas destinadas a usuários autenticados do ERP.

### 11.3 Campos que o Site deveria receber

Públicos: `id`, `sku`, `name`, `description`, `sale_price`, estado público, imagem principal; futuramente cores ativas, imagens por cor, tamanhos ativos e uma disponibilidade derivada (não necessariamente o saldo exato).

Nunca públicos: `cost_price`, `minimum_stock`, quantidades anteriores, movimentações, lucro, fornecedores, dados financeiros, auditoria, autoria interna, notas internas, dados pessoais de clientes e detalhes operacionais privados.

### 11.4 Informações que ainda precisam existir

- Estado editorial independente do `products.status` comercial.
- Galeria complementar vinculada individualmente a cada cor.
- Seleção da foto principal utilizada no e-commerce e ordenação das imagens de cada galeria.
- Texto alternativo e metadados de mídia.
- Destaque e SEO editorial.
- Política clara de disponibilidade pública derivada do estoque.

### 11.5 Tabelas novas que fazem sentido

- `site_product_media`: galeria complementar vinculada a `product_colors.id` por `product_color_id`. Cada cor pode possuir múltiplas imagens. O Site controla a ordem, os textos alternativos e qual foto será a principal no e-commerce; o ERP continua responsável por `product_colors.image_url`, a imagem principal operacional da cor.
- `site_product_settings`: publicação editorial, destaque e SEO, separados do status comercial do ERP.

Estrutura documental planejada para `site_product_media`:

| Campo de relacionamento | Referência | Cardinalidade | Responsabilidade |
|---|---|---|---|
| `product_color_id` | `product_colors.id` | Uma cor para muitas mídias | Associar cada imagem complementar à cor correta. |

```text
products
  └── product_colors
        ├── image_url                    (imagem principal da cor — ERP)
        └── site_product_media[]         (galeria complementar — Site)
              ├── ordem das imagens
              ├── foto principal no e-commerce
              └── metadados editoriais
```

### 11.6 Estruturas desnecessárias

- Nova tabela de produtos do Site duplicando nome, SKU e preço.
- Nova tabela de estoque do Site.
- Nova tabela de cores/tamanhos se o Site apenas espelha as entidades do ERP.
- Copiar clientes, vendas ou pedidos para um segundo modelo sem requisito de integração concreto.
- Duplicar `product_colors.image_url` dentro de `site_product_media`. A imagem do ERP permanece como origem operacional da cor; a tabela do Site deve conter somente a galeria complementar e sua configuração editorial.

## 12. Oportunidades de melhoria

Somente pontos com impacto arquitetural real:

1. **Reconciliar schema local e Supabase real.** É o risco principal. Executar futuramente os diagnósticos somente com aprovação e registrar um baseline versionado.
2. **Eliminar a transição incompleta de cores.** `product_variations.color` e `product_color_id` duplicam o mesmo conceito; a FK é nullable e a unicidade nova não existe. Após validar dados, tornar a relação canônica evita divergência.
3. **Garantir consistência produto–cor–variação.** Hoje duas FKs independentes não impedem uma variação de apontar para produto A e cor do produto B. Uma constraint composta ou remoção da redundância resolveria.
4. **Definir unicidade do SKU.** Se SKU é referência pública/operacional, um índice não único permite ambiguidade em `getProductByReference` e integrações.
5. **Versionar `vw_site_products`.** O Site já depende dela, mas sua definição não está nos SQLs analisados. Documentá-la é necessário para reprodução do ambiente.
6. **Revisar segurança das views legadas.** Padronizar `security_invoker` ou outro modelo comprovado e auditar grants evita bypass involuntário de RLS.
7. **Fechar a transação de criação de produto.** Hoje produto, uploads, cores e variações são etapas separadas no cliente; falha intermediária pode deixar dados parciais e arquivos órfãos. Uma operação controlada para metadados, com estratégia explícita para Storage, reduziria inconsistência.
8. **Completar auditoria de produto.** O frontend contém TODOs após salvar/inativar produto; mudanças de catálogo podem não entrar em `audit_logs`.
9. **Formalizar relações polimórficas.** `financial_entries.reference_id` e `stock_movements.reference_id` não possuem FK. Isso é flexível, mas exige validação rigorosa nas RPCs e rotinas de integridade.
10. **Padronizar numeração dos incrementos.** Existem dois arquivos `013`, o que dificulta reprodução e prova de ordem.
11. **Evitar exposição de chave/configuração no código versionado.** A chave anon é pública por natureza, mas URL e chave hardcoded dificultam rotação e separação de ambientes; configuração por ambiente é mais segura operacionalmente.
12. **Definir política de remoção de arquivos.** Upload por slug com `upsert` não remove arquivos de cores renomeadas/inativadas; uma rotina controlada futura deve evitar órfãos sem apagar mídia histórica indevidamente.

## 13. Lacunas e informações não determinadas

- Não foi possível confirmar quais SQLs, exceto 014, foram realmente aplicados no Supabase.
- Não foi possível confirmar colunas, constraints, índices, owners, grants e policies efetivos do banco remoto.
- A definição SQL, owner, grants e segurança de `vw_site_products` não estão versionados nos arquivos analisados.
- Não há criação versionada de pedidos do Site.
- Não foi possível confirmar se todos os registros de `product_variations` possuem `product_color_id` ou se há divergência com `color`.
- Não foi possível confirmar unicidade real dos SKUs ou a existência de duplicados/nulos.
- Não foi possível determinar se o SQL 010 de fornecedores/despesas foi aplicado, apesar de o frontend depender dele.
- Não foi possível confirmar buckets e policies reais de Storage sem consultar o projeto Supabase.
- `site_product_media` e `site_product_settings` existem apenas como documentação planejada na pasta `database/`; não foram tratadas como tabelas existentes.

## 14. Resumo final

O ERP possui um modelo coerente centrado em produto, cor e variação: produto contém dados comerciais; cor contém identidade visual por cor; variação contém tamanho e estoque; movimentos preservam histórico. Vendas e pedidos congelam dados dos itens e usam RPCs para coordenar estoque, financeiro e auditoria.

Para o E-commerce, a direção correta é manter o ERP como fonte de verdade e expor somente uma projeção pública por `vw_site_products`, consumida pelo repository do Site. Novas tabelas do Site só se justificam para responsabilidades editoriais que o ERP não possui. A galeria complementar pertence à cor por `site_product_media.product_color_id`; o ERP mantém a imagem principal operacional em `product_colors.image_url`, enquanto o Site controla múltiplas imagens, ordem e foto principal usada no e-commerce. Isso evita duplicar produto, preço, cor ou estoque.

Antes de qualquer evolução estrutural, a prioridade é reconciliar o schema esperado com o banco real e versionar a definição da view pública. Sem esse baseline, documentos e frontend indicam intenção e dependência, mas não provam o estado implantado.

# Próximas Sprints

## Sprint 6

- Criar tabelas definitivas.
- Criar RLS.
- Criar documentação SQL.

## Sprint 7

- Criar o repository da galeria.
- Criar o repository das configurações.

## Sprint 8

- Criar o Painel da galeria.
- Implementar upload.
- Implementar exclusão.
- Implementar definição da foto principal.
- Implementar ordenação.

## Sprint 9

- Consumir a galeria no Site.
- Implementar galeria por cor.
- Concluir a integração completa.
