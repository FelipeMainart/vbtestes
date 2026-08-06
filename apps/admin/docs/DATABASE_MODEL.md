# Modelagem do Banco de Dados - Veste Bem Admin

Este documento apresenta a modelagem tecnica da FASE 3 para revisao. Ele nao contem SQL e nao cria banco, triggers, functions ou policies.

## Objetivo da modelagem

Definir a estrutura do banco Supabase/PostgreSQL para sustentar o MVP administrativo da Veste Bem, incluindo autenticacao, permissoes, vendas, pedidos, produtos, estoque, clientes, financeiro, auditoria e configuracoes.

## Regras oficiais consideradas

- Vendas e pedidos compartilham numeracao operacional unica via `operation_sequence`.
- Nao existem sequencias separadas para vendas e pedidos.
- Venda nao e excluida fisicamente.
- Status no banco usam chaves internas sem acento, em ingles e snake_case.
- Labels em portugues ficam na interface.
- Venda pode ser `completed` ou `cancelled`.
- Venda cancelada permanece no banco, historico e auditoria.
- Venda cancelada devolve estoque e reverte financeiro quando aplicavel.
- Cancelamento de venda e exclusivo do Administrador.
- Pedido nao e excluido fisicamente.
- Pedido usa os status internos: `awaiting_payment`, `paid`, `in_separation`, `awaiting_shipping`, `shipped`, `delivered`, `finalized` e `cancelled`.
- `orders.payment_status` usa `pending`, `paid`, `cancelled` e `refunded`.
- Pedido em `delivered` por 7 dias muda para `finalized`.
- Pedido finalizado sai das pendencias operacionais e permanece no historico.
- Pedido cancelado antes do pagamento nao gera lancamento financeiro, apenas auditoria.
- `Cliente Diversos` e registro padrao oficial.
- Produto inativo nao aparece em vendas, pedidos ou seletores operacionais.
- Produto inativo continua em historico e relatorios.
- `financial_entries` e a tabela central do financeiro.
- Entradas automaticas vem de vendas e pedidos pagos.
- Entradas manuais sao exclusivas de administrador.
- `expenses` guarda o detalhe da despesa, mas toda despesa deve gerar ou se relacionar com um lancamento em `financial_entries`.
- Despesas sao gerenciadas por administrador.
- Auditoria deve registrar usuario, data, hora, acao, modulo, valor anterior e valor novo.
- O primeiro administrador sera criado manualmente no Supabase Auth e depois recebera registro em `profiles` com `role = admin` e `active = true`.
- Vendedor nao insere diretamente em `sales` ou `sale_items`; vendas sao criadas apenas por `create_sale_with_items`.
- Pedidos do site serao criados futuramente por funcao controlada, Edge Function ou service role, nunca por botao "Novo Pedido" no painel.
- Pedidos serao processados por funcoes controladas: `mark_order_paid`, `update_order_status`, `update_order_tracking`, `cancel_order` e `finalize_delivered_orders`.
- `adjust_stock` e funcao interna/restrita; ajustes manuais devem passar por funcao administrativa.
- `audit_logs` nao permite insert direto por usuarios autenticados.
- Auditoria e criada apenas por funcoes internas controladas, como `create_audit_log`.
- `create_audit_log` nao deve ter execute publico direto para `authenticated`.

## Lista completa de tabelas

### `profiles`

Objetivo: complementar `auth.users` com dados operacionais e perfil de acesso.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK e FK para `auth.users.id` |
| `name` | text | sim | Nome exibido no painel |
| `role` | text | sim | `admin` ou `seller` |
| `active` | boolean | sim | Define se pode acessar o painel |
| `created_at` | timestamptz | sim | Data/hora de criacao |
| `updated_at` | timestamptz | sim | Data/hora de atualizacao |

Relacionamentos:

- `profiles.id` referencia `auth.users.id`.
- Usado como FK em registros criados/alterados por usuarios.

### `operation_sequence`

Objetivo: gerar numeracao operacional unica para vendas e pedidos.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | bigint | sim | PK sequencial interna |
| `entity_type` | text | sim | `sale` ou `order` |
| `created_at` | timestamptz | sim | Data/hora da geracao |

Relacionamentos:

- `sales.operation_number` recebe valor de `operation_sequence.id`.
- `orders.operation_number` recebe valor de `operation_sequence.id`.

Regra: a numeracao exibida deve ser formatada com 5 digitos, por exemplo `00001`.

### `customers`

Objetivo: armazenar clientes e o registro padrao `Cliente Diversos`.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `name` | text | sim | Nome do cliente |
| `whatsapp` | text | nao | Telefone/WhatsApp |
| `email` | text | nao | E-mail |
| `city` | text | nao | Cidade |
| `cpf` | text | nao | CPF opcional |
| `notes` | text | nao | Observacoes |
| `is_default` | boolean | sim | Marca `Cliente Diversos` |
| `created_by` | uuid | nao | FK para `profiles.id` |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Relacionamentos:

- `sales.customer_id` referencia `customers.id`.
- `orders.customer_id` referencia `customers.id`.

Regra: deve existir exatamente um cliente padrao com `is_default = true`.

### `products`

Objetivo: armazenar os produtos principais, incluindo preco, custo e status.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `name` | text | sim | Nome do produto |
| `description` | text | nao | Descricao |
| `sale_price` | numeric(10,2) | sim | Preco de venda |
| `cost_price` | numeric(10,2) | sim | Custo, restrito a admin |
| `image_url` | text | nao | URL da imagem no Storage |
| `status` | text | sim | `active` ou `inactive` |
| `created_by` | uuid | nao | FK para `profiles.id` |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Relacionamentos:

- `product_colors.product_id` referencia `products.id`.
- `product_variations.product_id` referencia `products.id`.
- `sale_items.product_id` referencia `products.id`.
- `order_items.product_id` referencia `products.id`.

Regra: produtos inativos ficam fora de seletores operacionais, mas permanecem em historico e relatorios.

### `product_colors`

Objetivo: representar as cores de cada produto como entidade propria e armazenar a imagem especifica da cor para catalogo, pedidos online e site futuro.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `product_id` | uuid | sim | FK para `products.id` |
| `color_name` | text | sim | Nome exibido da cor |
| `image_url` | text | nao | URL publica da imagem da cor no Storage |
| `active` | boolean | sim | Define se a cor aparece em operacoes e catalogo |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Relacionamentos:

- `product_colors.product_id` referencia `products.id`.
- `product_variations.product_color_id` referencia `product_colors.id`.

Regras:

- A combinacao `product_id + color_name` deve ser unica.
- Cores nao devem ser excluidas fisicamente; devem ser inativadas com `active = false`.
- A imagem pertence a cor, nao a cada tamanho.
- Todos os tamanhos de uma cor reutilizam `product_colors.image_url`.

### `product_variations`

Objetivo: controlar variacoes por cor do produto, tamanho e estoque.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `product_id` | uuid | sim | FK para `products.id` |
| `product_color_id` | uuid | nao por enquanto | FK para `product_colors.id`; sera obrigatoria apos migracao validada |
| `color` | text | sim temporariamente | Cor em texto mantida para compatibilidade durante a migracao |
| `size` | text | sim | Tamanho |
| `quantity` | integer | sim | Estoque atual |
| `minimum_stock` | integer | sim | Estoque minimo |
| `status` | text | sim | `active` ou `inactive` |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Relacionamentos:

- `product_variations.product_color_id` referencia `product_colors.id`.
- `sale_items.variation_id` referencia `product_variations.id`.
- `order_items.variation_id` referencia `product_variations.id`.
- `stock_movements.variation_id` referencia `product_variations.id`.

Regra atual de compatibilidade: combinacao `product_id + color + size` deve ser unica.

Regra desejada apos migracao validada: combinacao `product_color_id + size` deve ser unica.

### `stock_movements`

Objetivo: registrar todas as alteracoes de estoque.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `variation_id` | uuid | sim | FK para variacao |
| `movement_type` | text | sim | `entry`, `exit`, `adjustment`, `sale`, `order`, `cancel_sale`, `cancel_order` |
| `quantity` | integer | sim | Quantidade movimentada |
| `previous_quantity` | integer | sim | Estoque antes |
| `new_quantity` | integer | sim | Estoque depois |
| `reason` | text | nao | Motivo, obrigatorio em ajustes/saidas manuais |
| `reference_type` | text | nao | `sale`, `order`, `manual` |
| `reference_id` | uuid | nao | ID da entidade relacionada |
| `created_by` | uuid | nao | FK para `profiles.id` |
| `created_at` | timestamptz | sim | Criacao |

Relacionamentos:

- Referencia `product_variations`.
- Pode apontar para venda, pedido ou ajuste manual via `reference_type` e `reference_id`.

### `sales`

Objetivo: armazenar vendas concluidas ou canceladas.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `operation_number` | bigint | sim | Numero unico vindo de `operation_sequence` |
| `customer_id` | uuid | sim | FK para `customers.id` |
| `channel` | text | sim | Loja Fisica, WhatsApp, Instagram ou Site |
| `payment_method` | text | sim | Pix, Dinheiro ou Cartao |
| `gross_total` | numeric(10,2) | sim | Total bruto |
| `discount` | numeric(10,2) | sim | Desconto |
| `net_total` | numeric(10,2) | sim | Total liquido |
| `total_cost` | numeric(10,2) | sim | Custo congelado, restrito a admin |
| `estimated_gross_profit` | numeric(10,2) | sim | Lucro estimado, restrito a admin |
| `status` | text | sim | `completed` ou `cancelled` |
| `invoice_requested` | boolean | sim | Cliente solicitou nota |
| `invoice_number` | text | nao | Numero da nota |
| `invoice_status` | text | sim | `none`, `pending` ou `issued` |
| `notes` | text | nao | Observacoes |
| `created_by` | uuid | nao | FK para `profiles.id` |
| `updated_by` | uuid | nao | FK para `profiles.id` |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |
| `cancelled_at` | timestamptz | nao | Data/hora de cancelamento |

Relacionamentos:

- `sales.customer_id` referencia `customers.id`.
- `sale_items.sale_id` referencia `sales.id`.
- `financial_entries.reference_id` pode apontar para `sales.id`.

Regra: nao ha exclusao fisica de vendas.

Regra de criacao: registros em `sales` e `sale_items` devem ser criados pela funcao transacional `create_sale_with_items`, nao por inserts diretos do painel.

### `sale_items`

Objetivo: armazenar itens vendidos com dados historicos congelados.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `sale_id` | uuid | sim | FK para `sales.id` |
| `product_id` | uuid | sim | FK para `products.id` |
| `variation_id` | uuid | sim | FK para `product_variations.id` |
| `product_name` | text | sim | Nome congelado |
| `color` | text | sim | Cor congelada |
| `size` | text | sim | Tamanho congelado |
| `quantity` | integer | sim | Quantidade |
| `unit_price` | numeric(10,2) | sim | Preco unitario |
| `unit_cost` | numeric(10,2) | sim | Custo unitario congelado |
| `subtotal` | numeric(10,2) | sim | Subtotal |
| `total_cost` | numeric(10,2) | sim | Custo total |

Relacionamentos:

- Pertence a `sales`.
- Referencia produto e variacao para rastreabilidade.

### `orders`

Objetivo: armazenar pedidos criados futuramente pelo site e processados no painel.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `operation_number` | bigint | sim | Numero unico vindo de `operation_sequence` |
| `origin` | text | sim | Padrao `Site` |
| `customer_id` | uuid | sim | FK para `customers.id` |
| `customer_whatsapp` | text | nao | Snapshot do contato |
| `customer_email` | text | nao | Snapshot do e-mail |
| `customer_cpf` | text | nao | Snapshot do CPF |
| `products_total` | numeric(10,2) | sim | Total dos produtos |
| `discount` | numeric(10,2) | sim | Desconto |
| `shipping_value` | numeric(10,2) | sim | Frete |
| `total` | numeric(10,2) | sim | Total do pedido |
| `payment_method` | text | nao | Forma de pagamento |
| `payment_status` | text | sim | `pending`, `paid`, `cancelled`, `refunded` |
| `order_status` | text | sim | Status oficial do pedido |
| `postal_code` | text | nao | CEP |
| `street` | text | nao | Rua |
| `number` | text | nao | Numero |
| `complement` | text | nao | Complemento |
| `neighborhood` | text | nao | Bairro |
| `city` | text | nao | Cidade |
| `state` | text | nao | Estado |
| `shipping_method` | text | nao | Metodo de envio |
| `carrier` | text | nao | Transportadora |
| `estimated_deadline` | text | nao | Prazo estimado |
| `internal_notes` | text | nao | Observacoes internas |
| `paid_at` | timestamptz | nao | Quando foi pago |
| `delivered_at` | timestamptz | nao | Quando foi entregue |
| `finalized_at` | timestamptz | nao | Quando foi finalizado |
| `cancelled_at` | timestamptz | nao | Quando foi cancelado |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Status internos de `order_status`:

- `awaiting_payment`
- `paid`
- `in_separation`
- `awaiting_shipping`
- `shipped`
- `delivered`
- `finalized`
- `cancelled`

Labels exibidos na interface:

- `awaiting_payment`: Aguardando Pagamento
- `paid`: Pago
- `in_separation`: Em Separacao
- `awaiting_shipping`: Aguardando Envio
- `shipped`: Enviado
- `delivered`: Entregue
- `finalized`: Finalizado
- `cancelled`: Cancelado

Relacionamentos:

- `orders.customer_id` referencia `customers.id`.
- `order_items.order_id` referencia `orders.id`.
- `order_tracking.order_id` referencia `orders.id`.
- `financial_entries.reference_id` pode apontar para `orders.id`.

Regra: nao ha exclusao fisica de pedidos.

Regra de criacao: pedidos serao criados futuramente pelo site por funcao controlada, Edge Function ou service role. O painel nao tera botao "Novo Pedido".

### `order_items`

Objetivo: armazenar itens dos pedidos com dados historicos congelados.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `order_id` | uuid | sim | FK para `orders.id` |
| `product_id` | uuid | sim | FK para `products.id` |
| `variation_id` | uuid | sim | FK para `product_variations.id` |
| `product_name` | text | sim | Nome congelado |
| `color` | text | sim | Cor congelada |
| `size` | text | sim | Tamanho congelado |
| `quantity` | integer | sim | Quantidade |
| `unit_price` | numeric(10,2) | sim | Preco unitario |
| `unit_cost` | numeric(10,2) | sim | Custo unitario congelado |
| `subtotal` | numeric(10,2) | sim | Subtotal |
| `total_cost` | numeric(10,2) | sim | Custo total |

Relacionamentos:

- Pertence a `orders`.
- Referencia produto e variacao para rastreabilidade.

### `order_tracking`

Objetivo: armazenar informacoes de rastreio dos pedidos.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `order_id` | uuid | sim | FK para `orders.id` |
| `tracking_code` | text | nao | Codigo de rastreio |
| `tracking_link` | text | nao | Link de rastreio |
| `carrier` | text | nao | Transportadora |
| `shipped_at` | timestamptz | nao | Data/hora de envio |
| `estimated_delivery_date` | date | nao | Entrega prevista |
| `delivered_at` | timestamptz | nao | Entrega confirmada |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Relacionamentos:

- Pertence a `orders`.

### `financial_entries`

Objetivo: registrar receitas, despesas e reversoes consolidadas.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `type` | text | sim | `income`, `expense` ou `reversal` |
| `origin` | text | sim | `automatic` ou `manual` |
| `category` | text | sim | Categoria financeira |
| `description` | text | nao | Descricao |
| `amount` | numeric(10,2) | sim | Valor |
| `status` | text | sim | `active` ou `cancelled` |
| `reference_type` | text | nao | `sale`, `order`, `expense` |
| `reference_id` | uuid | nao | ID da referencia |
| `created_by` | uuid | nao | FK para `profiles.id` |
| `updated_by` | uuid | nao | FK para `profiles.id` |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Relacionamentos:

- Pode referenciar venda, pedido ou despesa.

Regra: `financial_entries` e a tabela central do financeiro. Entradas automaticas nascem de vendas concluidas e pedidos pagos; entradas manuais sao exclusivas de admin.

### `expenses`

Objetivo: armazenar despesas operacionais.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `category` | text | sim | Categoria |
| `description` | text | nao | Descricao |
| `amount` | numeric(10,2) | sim | Valor |
| `payment_method` | text | nao | Forma de pagamento |
| `expense_date` | date | sim | Data da despesa |
| `notes` | text | nao | Observacoes |
| `created_by` | uuid | nao | FK para `profiles.id` |
| `updated_by` | uuid | nao | FK para `profiles.id` |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |
| `deleted_at` | timestamptz | nao | Exclusao logica |
| `financial_entry_id` | uuid | nao | FK para `financial_entries.id` |

Relacionamentos:

- Deve gerar ou se relacionar com um registro em `financial_entries`.

Regra: apenas administrador pode criar, editar ou excluir despesas.

### `audit_logs`

Objetivo: registrar eventos criticos do sistema.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `user_id` | uuid | nao | FK para `profiles.id` |
| `user_role` | text | nao | Perfil no momento da acao |
| `action` | text | sim | Acao realizada |
| `module` | text | sim | Modulo afetado |
| `entity_type` | text | nao | Tipo de entidade |
| `entity_id` | uuid | nao | ID da entidade |
| `before_data` | jsonb | nao | Valor anterior |
| `after_data` | jsonb | nao | Valor novo |
| `ip_address` | text | nao | IP, se disponivel |
| `user_agent` | text | nao | Dispositivo/navegador, se disponivel |
| `created_at` | timestamptz | sim | Data e hora da acao |

Relacionamentos:

- `audit_logs.user_id` referencia `profiles.id`.

Regra: deve conter usuario, data, hora, acao, modulo, valor anterior e valor novo sempre que aplicavel.

Regra de gravacao: nao ha insert direto em `audit_logs` para usuarios autenticados. A gravacao deve ocorrer apenas por funcoes internas controladas.

### `settings`

Objetivo: armazenar configuracoes do sistema e empresa.

Campos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `key` | text | sim | Chave unica |
| `value` | jsonb | nao | Valor flexivel |
| `updated_by` | uuid | nao | FK para `profiles.id` |
| `updated_at` | timestamptz | sim | Atualizacao |

Relacionamentos:

- `settings.updated_by` referencia `profiles.id`.

## Relacionamentos gerais

- `auth.users` 1:1 `profiles`.
- `profiles` 1:N `customers`, `products`, `sales`, `stock_movements`, `financial_entries`, `expenses`, `audit_logs`, `settings`.
- `customers` 1:N `sales`.
- `customers` 1:N `orders`.
- `products` 1:N `product_colors`.
- `products` 1:N `product_variations`.
- `product_colors` 1:N `product_variations`.
- `products` 1:N `sale_items`.
- `products` 1:N `order_items`.
- `product_variations` 1:N `sale_items`.
- `product_variations` 1:N `order_items`.
- `product_variations` 1:N `stock_movements`.
- `sales` 1:N `sale_items`.
- `orders` 1:N `order_items`.
- `orders` 1:N `order_tracking`.
- `sales` 1:N `financial_entries` via referencia logica.
- `orders` 1:N `financial_entries` via referencia logica.
- `expenses` 1:N `financial_entries` via referencia logica.
- `operation_sequence` fornece numero unico para `sales` e `orders`.

## Estrategia de autenticacao

O Supabase Auth gerencia credenciais em `auth.users`.

`profiles` armazena dados operacionais:

- nome;
- perfil;
- status ativo/inativo.

Perfis:

- `admin`: acesso total, incluindo custos, lucro, financeiro, auditoria, configuracoes e ajustes criticos.
- `seller`: acesso operacional, sem custo, lucro, financeiro completo, auditoria ou configuracoes.

Fluxo:

1. Usuario autentica no Supabase Auth.
2. Aplicacao consulta `profiles` pelo `auth.uid()`.
3. Se `active = false`, acesso ao painel e bloqueado.
4. Permissoes sao carregadas conforme `role`.
5. Primeiro administrador e criado manualmente no Supabase Auth.
6. Em seguida, um registro correspondente e criado em `profiles` com `role = admin` e `active = true`.

## Estrategia de RLS

RLS deve estar ativo nas tabelas operacionais.

Diretrizes de leitura:

- Admin le dados completos.
- Seller le apenas dados operacionais permitidos.
- Seller nao le custo, lucro, financeiro completo ou auditoria.
- Para esconder colunas sensiveis, usar views sem custo/lucro quando necessario.

Diretrizes de escrita:

- Admin pode criar/editar produtos, configuracoes, financeiro, despesas e ajustes de estoque.
- Seller pode criar clientes.
- Seller registra vendas apenas via `create_sale_with_items`.
- Seller pode consultar estoque sem custo.
- Seller nao pode excluir despesas, cancelar vendas, cancelar operacoes criticas ou alterar configuracoes.
- Seller nao tem insert direto em `sales` ou `sale_items`.
- Seller nao tem update direto amplo em `orders`; alteracoes passam por funcoes controladas.

Diretrizes de exclusao:

- Vendas nao sao excluidas fisicamente.
- Pedidos nao sao excluidos fisicamente.
- Despesas devem usar exclusao logica e apenas por admin.
- Produtos devem preferencialmente ser inativados, nao apagados.
- Auditoria nao deve ser excluida pelo painel.

## Estrategia de auditoria

Auditoria sera registrada em `audit_logs`.

Campos minimos obrigatorios:

- usuario;
- data;
- hora;
- acao;
- modulo;
- valor anterior;
- valor novo.

Tabelas/eventos monitorados especialmente:

- `products`;
- `product_colors`;
- `product_variations`;
- `stock_movements`;
- `sales`;
- `orders`;
- `financial_entries`;
- `expenses`;
- `settings`.

Eventos criticos:

- venda criada;
- venda cancelada;
- pedido alterado;
- pedido pago;
- pedido cancelado;
- produto criado/editado/inativado;
- estoque ajustado;
- despesa criada/editada/excluida;
- configuracao alterada.

Permissoes:

- Admin pode consultar auditoria.
- Vendedor nao pode consultar auditoria.
- Nenhum usuario autenticado pode inserir diretamente em `audit_logs`.
- `create_audit_log` permanece sem execute publico para `authenticated`.
- Funcoes controladas, como `create_sale_with_items`, `cancel_sale`, `admin_adjust_stock`, `mark_order_paid`, `cancel_order`, `update_order_status` e `update_order_tracking`, podem chamar `create_audit_log` internamente.

## Estrategia de funcoes controladas

### `create_sale_with_items`

Funcao transacional para registro de venda.

Responsabilidades:

- gerar `operation_number` em `operation_sequence`;
- criar `sales`;
- criar `sale_items`;
- validar produto ativo;
- validar variacao ativa;
- bloquear estoque negativo;
- baixar estoque;
- criar `financial_entries`;
- criar `audit_logs`.

Vendedores e administradores registram venda por esta funcao. Inserts diretos em `sales` e `sale_items` nao devem ser liberados ao painel.

### `edit_sale_with_items`

Funcao transacional para edicao segura de venda.

Responsabilidades:

- validar se a venda existe e nao esta cancelada;
- permitir admin a qualquer momento;
- permitir seller apenas ate 24 horas apos `sales.created_at`;
- exigir motivo para seller;
- carregar venda, itens e financeiro anteriores para auditoria;
- devolver ao estoque os itens antigos;
- validar estoque disponivel considerando a devolucao dos itens antigos;
- inserir os novos `sale_items`;
- baixar estoque dos novos itens;
- recalcular `gross_total`, `discount`, `net_total`, `total_cost` e `estimated_gross_profit`;
- atualizar `financial_entries` automatico vinculado a venda sem criar duplicidade;
- manter `operation_number` e `created_at` originais;
- atualizar `updated_at` e `updated_by`;
- registrar `audit_logs` com antes, depois, usuario, perfil, data/hora e motivo.

O painel nao deve editar `sales`, `sale_items`, `stock_movements` ou `financial_entries` diretamente. Toda edicao de venda deve passar por `edit_sale_with_items`.

### `adjust_stock`

Funcao interna/restrita para movimentacao de estoque.

Regras:

- nao deve ser chamada livremente por usuarios autenticados;
- movimentos de venda e pedido sao feitos internamente por funcoes controladas;
- ajustes manuais usam funcao administrativa, restrita a admin.

### Funcoes de pedido

Funcoes controladas:

- `mark_order_paid`;
- `update_order_status`;
- `update_order_tracking`;
- `cancel_order`;
- `finalize_delivered_orders`.

Regras:

- evitar update direto amplo em `orders`;
- pedido pago baixa estoque e cria financeiro;
- pedido cancelado antes do pagamento gera apenas auditoria;
- pedido pago cancelado devolve estoque e cancela/reverte financeiro;
- rastreio e status operacional passam pelas funcoes controladas.

## Estrategia de estoque

Estoque atual fica em `product_variations.quantity`.

As variacoes passam a ser agrupadas por `product_colors`, permitindo a visualizacao operacional:

```text
Produto
-> Cor
   -> Tamanhos
```

Toda alteracao gera `stock_movements`.

Regras:

- Venda com status `completed` baixa estoque no momento da criacao via `create_sale_with_items`.
- Pedido baixa estoque apenas quando muda para `paid` via `mark_order_paid`.
- Cancelamento de venda devolve estoque quando ja houve baixa.
- Cancelamento de pedido pago devolve estoque.
- Entrada manual aumenta estoque e exige motivo.
- Saida manual reduz estoque e exige motivo.
- Ajuste manual exige motivo.
- Bloquear estoque negativo no fluxo normal.

Produtos e variacoes inativos nao aparecem em seletores operacionais.

## Estrategia financeira

Tabela principal: `financial_entries`.

Receitas automaticas:

- venda concluida gera entrada automatica;
- pedido pago gera entrada automatica.
- pedido cancelado antes do pagamento nao gera lancamento financeiro, apenas auditoria.

Entradas manuais:

- permitidas apenas para administrador;
- devem registrar auditoria.

Despesas:

- criadas e gerenciadas apenas por administrador;
- exclusao deve ser logica;
- exclusao deve registrar auditoria;
- lancamento financeiro relacionado deve ser cancelado ou revertido conforme regra definida.

Reversoes:

- cancelamento de venda, exclusivo do admin, deve cancelar ou gerar reversao do lancamento automatico;
- cancelamento de pedido pago deve cancelar ou gerar reversao do lancamento automatico;
- relatorios devem desconsiderar lancamentos cancelados.

Lucro:

- lucro bruto estimado considera receita liquida dos produtos menos custo dos produtos vendidos.
- custo e lucro sao visiveis apenas para administrador.

## Decisoes aprovadas antes da geracao dos SQLs

- Status no banco usam chaves internas sem acento e em ingles/snake_case.
- A interface exibe labels em portugues.
- `financial_entries` e a tabela central do financeiro.
- `expenses` guarda detalhe da despesa e deve se relacionar com `financial_entries`.
- Cancelamento de venda e exclusivo do administrador.
- Pedido cancelado antes do pagamento gera apenas auditoria.
- Primeiro administrador sera criado manualmente no Supabase Auth e depois em `profiles`.
- Primeiro administrador deve ser registrado em `profiles` pelo SQL Editor com o UUID do usuario criado em `auth.users`, `role = admin` e `active = true`.
- Vendas devem ser registradas por `create_sale_with_items`.
- Pedidos futuros do site devem ser criados por funcao controlada, Edge Function ou service role.
- `audit_logs` nao tem insert direto para `authenticated`; auditoria passa por `create_audit_log` internamente.
