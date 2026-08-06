# Release Veste Bem Admin v1.0

Data da versão: **15/07/2026**  
Ambiente: **produção**  
URL: [https://veste-bem-omega.vercel.app](https://veste-bem-omega.vercel.app)

## Objetivo

Entregar uma operação administrativa estável para a loja física, centralizando vendas, estoque, clientes, financeiro, pedidos, relatórios, usuários, configurações e recibos.

## Módulos incluídos

- Autenticação e usuários;
- Dashboard;
- Produtos e variações;
- Estoque;
- Clientes;
- Vendas;
- Recibo térmico, PDF, impressão e WhatsApp;
- Financeiro e fornecedores;
- Pedidos Online;
- Relatórios;
- Auditoria;
- Configurações;
- Design System V2 e responsividade.

## Regras principais

- Vendas e pedidos usam numeração operacional compartilhada.
- Operações concluídas não são excluídas fisicamente.
- Estoque, financeiro e auditoria são atualizados por RPCs transacionais.
- Cancelamentos revertem estoque e financeiro quando aplicável.
- “Cliente Diversos” atende vendas sem identificação individual.
- Produtos inativos continuam disponíveis para histórico e relatórios.
- O recibo pertence ao fluxo de Vendas.

## Usuários e permissões

- Login por e-mail ou username, com opção “Lembrar de mim”.
- Admin acessa custos, lucro, financeiro completo, auditoria, configurações e gestão de usuários.
- Seller possui acesso operacional e não recebe custos internos.
- Usuários inativos são impedidos de acessar o painel.
- Criação, edição e reset de senha passam pela Edge Function `admin-users`.

## Segurança

- Supabase Auth e RLS protegem os dados.
- Funções críticas executam regras transacionais no banco.
- A Service Role permanece restrita à Edge Function.
- Redirecionamentos de login aceitam apenas destinos internos conhecidos.
- Custos de itens de pedidos não são expostos na view de Seller.

## Recibo e impressão

- Template térmico oficial com largura de 80 mm.
- Mesmo template utilizado no preview, PDF e impressão.
- PDF baixado com identificação da venda.
- Impressão utiliza CSS térmico dedicado.
- WhatsApp abre a conversa com o cliente; não existe envio automático do PDF por API nesta versão.

## Migration 014

`014_secure_order_items_and_login_redirect.sql` foi aplicada e validada em produção:

- removeu `order_items_authenticated_select`;
- criou `order_items_admin_select`;
- restringiu a tabela completa a Admin;
- disponibilizou `order_items_seller_view` sem custos;
- preservou `unit_cost` e `total_cost` para operações administrativas;
- manteve as funções internas necessárias;
- acompanhou a validação segura do redirect no frontend.

## Checklist de produção

Os itens abaixo estão respaldados pela revisão funcional concluída informada para a v1.0 e pelo uso real do sistema:

- [x] Login validado
- [x] Admin validado
- [x] Seller validado
- [x] Usuário inativo validado
- [x] Criação e edição de usuário
- [x] Reset de senha
- [x] Dashboard
- [x] Produtos
- [x] Estoque
- [x] Clientes
- [x] Vendas
- [x] Recibo térmico
- [x] PDF
- [x] Impressão
- [x] WhatsApp
- [x] Financeiro
- [x] Pedidos
- [x] Relatórios
- [x] Configurações
- [x] Migration 014 aplicada
- [x] Redirect seguro
- [x] Custos protegidos para Seller

## Limitações conhecidas

- Pedidos ainda não entram automaticamente pelo site.
- Pix ainda não está integrado.
- Melhor Envio ainda não está integrado.
- WhatsApp abre a conversa, sem envio automático de PDF por API.
- E-mails automáticos ainda não foram implementados.
- O ambiente de homologação ainda será criado.
- Melhorias profundas de UI/mobile ficam para a v2.
- PWA fica para a v2.
- Uma possível mudança de stack ainda será avaliada.
- O baseline definitivo do banco ainda não foi formalizado.

## Migrations preservadas

- Os SQLs históricos permanecem em `database/sql`.
- A migration 014 está aplicada.
- Os dois arquivos 013 permanecem com seus nomes atuais até o baseline.
- O próximo número provisório local é 015.
- Novas mudanças deverão ser validadas primeiro em homologação.

## Itens da v2

Consulte `ROADMAP_V2.md` para homologação, experiência, e-commerce, comunicação e expansão.

