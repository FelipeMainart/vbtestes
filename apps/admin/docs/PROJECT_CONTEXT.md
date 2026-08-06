# Contexto do Projeto - Veste Bem Admin

## Objetivo do sistema

O Veste Bem Admin é um painel administrativo interno para a loja de coletes femininos Veste Bem. O foco do MVP é controlar a operação diária, sem ser um e-commerce completo ou ERP total. Ele deve suportar:

- controle de produtos, variações e estoque;
- cadastro e histórico de clientes;
- registro de vendas por loja física, WhatsApp e Instagram;
- processamento futuro de pedidos vindos do site;
- controle financeiro básico e entradas/saídas;
- geração de recibos sob demanda dentro do módulo Vendas;
- relatórios gerenciais;
- auditoria de eventos críticos.

## Tecnologias

- Frontend: HTML, CSS e JavaScript puro.
- Backend/Banco: Supabase com PostgreSQL.
- Autenticação: Supabase Auth.
- Permissões: frontend e Supabase Row Level Security (RLS).
- Storage: Supabase Storage apenas para imagens de produtos.
- Deploy sugerido: Netlify ou Vercel.
- Biblioteca recomendada: `supabase-js` para comunicação com Supabase.
- Geração de PDF: jsPDF ou pdfmake apenas para recibos, não armazenados no Storage.

## Módulos existentes (MVP previsto)

Menu oficial do MVP:

1. Dashboard
2. Vendas
3. Pedidos
4. Produtos
5. Estoque
6. Clientes
7. Financeiro
8. Relatórios
9. Auditoria
10. Configurações

Observação: não existe menu separado de Recibos. Recibos são parte do módulo Vendas.

## Decisões arquiteturais

- Arquitetura baseada em páginas estáticas e JavaScript modular, sem frameworks pesados.
- Separação clara entre interface, estilos, lógica JavaScript e backend.
- Interface com menu lateral fixo, topo e área principal dinâmica.
- Estilo visual moderno, minimalista e profissional, inspirado em sistemas administrativos como Bling, Tiny, Omie e Nuvemshop Admin.
- Estrutura de arquivos proposta com `assets/css`, `assets/js`, `assets/img`, `database/sql` e `docs`.
- JavaScript dividido em módulos pequenos e responsabilidade única.
- Supabase é responsável por autenticação, persistência de dados, RLS, funções SQL, views e storage de imagens de produtos.
- Regras de segurança devem ser garantidas no backend via RLS, não apenas pelo frontend.

## Decisões de banco de dados

- O banco usa PostgreSQL via Supabase.
- RLS deve estar ativo nas tabelas operacionais.
- A numeração operacional de vendas e pedidos é única e compartilhada por ambos (`operation_sequence`).
- Vendas e pedidos não devem ser excluídos fisicamente.
- Status internos no banco são em inglês e `snake_case`.
- Status de venda: `completed` e `cancelled`.
- Status de pedido: `awaiting_payment`, `paid`, `in_separation`, `awaiting_shipping`, `shipped`, `delivered`, `finalized` e `cancelled`.
- `orders.payment_status` usa `pending`, `paid`, `cancelled` e `refunded`.
- Tabelas previstas incluem `profiles`, `operation_sequence`, `customers`, `products`, `product_variations`, `stock_movements`, `sales`, `sale_items`, `orders`, `order_items`, `order_tracking`, `financial_entries`, `expenses`, `audit_logs` e `settings`.
- Views para vendedores devem ocultar custo, lucro e dados financeiros restritos.
- Funções SQL controladas devem centralizar regras críticas: criar venda com itens, baixar estoque, cancelar venda, marcar pedido pago, atualizar status de pedido, cancelar pedido, finalizar pedidos entregues, criar entradas financeiras e registrar auditoria.
- A primeira criação de administrador é manual no Supabase Auth, seguida de inserção de perfil em `profiles` com `role = admin` e `active = true`.
- Bucket de storage previsto: `product-images`.

## Permissões

Perfis principais:

- Administrador: acesso total, incluindo custos, lucro, financeiro completo, auditoria, edição/cancelamento de vendas, ajustes manuais, exclusão de despesas e configurações.
- Vendedor: acesso operacional limitado, com permissão para registrar vendas, consultar estoque, cadastrar clientes, gerar recibos e visualizar vendas conforme regras.

Restrições importantes:

- Vendedores não veem custo, lucro, financeiro completo ou auditoria.
- Vendedores não podem excluir produtos ou vendas.
- Vendedores não podem editar financeiro.
- Cancelamento de venda é exclusivo de administradores.
- Vendedores não inserem diretamente em `sales` ou `sale_items`; devem usar funções controladas.
- Ajustes de estoque manuais e operações financeiras manuais são exclusivas de administradores.
- Auditoria não deve aceitar inserts diretos de usuários autenticados; somente funções internas controladas.

## Status atual do desenvolvimento

- Fase atual: FASE 3 - Modelagem técnica do banco de dados Supabase.
- Status: FASE 3 aprovada.
- A documentação de arquitetura e planejamento está pronta.
- O banco ainda não foi criado nem os SQLs executados no Supabase.
- O projeto já possui documentos de fase, arquitetura, plano de desenvolvimento, setup Supabase e guia de execução de SQL.

## Fase concluída

- FASE 1 concluída e aprovada.
- FASE 2 concluída com sucesso, incluindo criação e atualização de documentação técnica.

## Próxima fase

- FASE 3: Implementação do banco de dados Supabase após aprovação da modelagem detalhada.
- Após a modelagem e revisão, serão criados os arquivos SQL locais de schema, RLS, funções, views e seed.
- Em sequência de aprovação, o próximo passo será a execução manual dos SQLs no Supabase e, em seguida, FASE 4 de autenticação e permissões.
