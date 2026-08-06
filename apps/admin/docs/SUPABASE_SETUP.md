# Planejamento Supabase - Veste Bem Admin

Este documento descreve como o Supabase sera preparado em fase futura. Nenhum banco, SQL ou configuracao real e criado na FASE 2.

## Responsabilidades do Supabase

O Supabase sera usado para:

- autenticacao de usuarios;
- banco PostgreSQL;
- Row Level Security;
- funcoes SQL de operacoes criticas;
- views para limitar dados por perfil;
- storage de imagens de produtos.

Supabase Storage nao sera usado para recibos.

## Variaveis de ambiente previstas

As variaveis finais serao definidas em `.env.example` em fase apropriada:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Somente a chave anonima publica deve ir para o frontend. Chaves de service role nao devem ser usadas no navegador.

## Autenticacao

O MVP usara Supabase Auth.

Fluxo previsto:

1. Usuario acessa `login.html`.
2. Informa e-mail e senha.
3. Supabase Auth valida credenciais.
4. Aplicacao consulta `profiles`.
5. Aplicacao valida se o usuario esta ativo.
6. Aplicacao carrega permissoes conforme `role`.
7. Usuario acessa o painel.
8. O primeiro administrador sera criado manualmente no Supabase Auth.
9. Depois sera executado um insert manual no SQL Editor em `profiles`, usando o `id` do usuario em `auth.users`, `role = admin` e `active = true`.

Perfis previstos:

- `admin`;
- `seller`.

## Tabelas previstas

As tabelas serao modeladas na primeira entrega da FASE 3 e criadas somente apos aprovacao da modelagem:

- `profiles`;
- `operation_sequence`;
- `customers`;
- `products`;
- `product_variations`;
- `stock_movements`;
- `sales`;
- `sale_items`;
- `orders`;
- `order_items`;
- `order_tracking`;
- `financial_entries`;
- `expenses`;
- `audit_logs`;
- `settings`.

## Views previstas

Para proteger dados sensiveis de vendedores, serao avaliadas views como:

- `vw_products_seller`;
- `vw_sales_seller`;
- `vw_stock_seller`.

Essas views devem ocultar custo, lucro e dados financeiros restritos.

## Funcoes previstas

Funcoes SQL devem concentrar regras que nao podem depender apenas do frontend. Elas serao apenas planejadas na modelagem e criadas em etapa posterior aprovada:

- gerar numero operacional unico;
- criar venda com itens pela funcao transacional `create_sale_with_items`;
- baixar estoque;
- cancelar venda e devolver estoque;
- marcar pedido como pago;
- atualizar status de pedido;
- atualizar rastreio de pedido;
- cancelar pedido pago e devolver estoque;
- finalizar pedido apos 7 dias em `delivered`;
- criar entradas financeiras automaticas;
- registrar auditoria;
- criar reversoes financeiras quando aplicavel.

## Politica de RLS

RLS deve estar ativo nas tabelas operacionais.

Diretrizes:

- usuarios autenticados e ativos podem acessar dados permitidos por perfil;
- vendedores nao podem acessar custos, lucro, financeiro completo ou auditoria;
- apenas administradores gerenciam produtos, custos, configuracoes e auditoria;
- vendedores podem criar vendas e clientes;
- vendedores registram vendas apenas via `create_sale_with_items`, sem insert direto em `sales` ou `sale_items`;
- vendedores podem consultar estoque sem custo;
- exclusoes fisicas criticas devem ser evitadas.
- vendas e pedidos nao devem ser excluidos fisicamente.
- apenas administradores podem criar entradas manuais, despesas e exclusoes logicas permitidas.
- cancelamento de venda e exclusivo de administradores.
- updates de pedidos passam por funcoes controladas, nao por update direto amplo em `orders`.
- `adjust_stock` nao deve ser chamada livremente por usuarios autenticados.

## Storage

Bucket previsto:

- `product-images`

Uso:

- armazenar imagens de produtos;
- permitir leitura conforme regra publica ou autenticada a definir;
- permitir upload apenas a administradores.

Nao armazenar:

- recibos PDF;
- relatorios exportados;
- documentos fiscais.

## Seed minimo previsto

Na FASE 3, o seed pode incluir:

- Cliente Diversos;
- configuracoes iniciais da empresa;
- categorias basicas de despesas;
- opcionalmente usuario/perfil inicial se o fluxo de criacao permitir.

`Cliente Diversos` e obrigatorio como registro padrao oficial. Quando o usuario nao quiser informar dados do cliente, a venda deve utilizar automaticamente esse registro.

## Regras de negocio que o banco deve sustentar

- Status no banco usam chaves internas sem acento, em ingles e snake_case. A interface exibe labels em portugues.
- Vendas usam status internos `completed` e `cancelled`.
- Venda cancelada permanece no banco, historico e auditoria.
- Cancelamento de venda devolve estoque quando aplicavel.
- Cancelamento de venda reverte lancamentos financeiros automaticos quando aplicavel.
- Pedidos usam os status internos `awaiting_payment`, `paid`, `in_separation`, `awaiting_shipping`, `shipped`, `delivered`, `finalized` e `cancelled`.
- `orders.payment_status` usa `pending`, `paid`, `cancelled` e `refunded`.
- Pedido finalizado permanece no historico e sai das pendencias operacionais.
- Pedido cancelado antes do pagamento gera apenas auditoria, sem lancamento financeiro.
- Produtos inativos nao aparecem em seletores operacionais, mas permanecem em historico e relatorios.
- `financial_entries` e a tabela central do financeiro.
- Entradas automaticas devem vir de vendas e pedidos pagos.
- Entradas manuais sao exclusivas de administrador.
- `expenses` guarda o detalhe da despesa, mas toda despesa deve gerar ou se relacionar com `financial_entries`.
- Despesas sao gerenciadas por administrador, incluindo exclusao logica.
- Numeracao operacional deve usar `operation_sequence`, compartilhada por vendas e pedidos.
- Pedidos do site serao criados futuramente por funcao controlada, Edge Function ou service role.
- O painel nao tera botao "Novo Pedido".

## Funcoes controladas obrigatorias

- `create_sale_with_items`: cria venda completa com itens, baixa estoque, financeiro, auditoria e numeracao unica.
- `admin_adjust_stock`: ajuste manual de estoque apenas para admin.
- `mark_order_paid`: marca pedido como pago, baixa estoque e cria financeiro.
- `update_order_status`: altera status operacional permitido.
- `update_order_tracking`: cria ou atualiza rastreio.
- `cancel_order`: cancela pedido, devolve estoque e reverte financeiro quando aplicavel.
- `finalize_delivered_orders`: finaliza pedidos entregues ha mais de 7 dias.

## Pendencias antes da FASE 3

Antes de criar o banco, confirmar:

- se o projeto Supabase ja existe;
- URL do projeto;
- primeiro administrador criado manualmente no Supabase Auth e registrado depois em `profiles` via SQL Editor;
- se o bucket de imagens sera publico ou autenticado;
- se a criacao de usuarios sera manual no Supabase ou pelo painel em fase futura.
