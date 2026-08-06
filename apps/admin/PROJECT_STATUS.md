# Status do projeto — Veste Bem Admin

Data de referência: 15/07/2026  
Versão: **1.0**  
Situação: **implementada e em uso real na loja**

## Implementado e em uso

- Autenticação com Supabase Auth.
- Login por e-mail ou username.
- Persistência de sessão com “Lembrar de mim”.
- Perfis Admin e Seller, usuários ativos/inativos e permissões por RLS.
- Dashboard operacional por dia, semana e mês.
- Produtos, cores, imagens, variações e SKU.
- Estoque, histórico de movimentações e ajuste administrativo.
- Clientes e registro oficial “Cliente Diversos”.
- Vendas presenciais, WhatsApp, Instagram e canal preparado para site.
- Edição e cancelamento transacionais de venda.
- Recibo térmico único de 80 mm para preview, PDF e impressão.
- Download de PDF com identificação da venda.
- Compartilhamento pelo WhatsApp mediante abertura da conversa.
- Financeiro, fornecedores, despesas, baixas e cancelamentos.
- Pedidos Online para acompanhamento e processamento operacional.
- Relatórios.
- Configurações da empresa e gestão de usuários.
- Auditoria das operações críticas existentes.
- Design System V2.
- Layout responsivo para desktop, notebook, tablet e mobile.
- Migration 014 aplicada e validada com Admin e Seller.
- Redirecionamento seguro após login.
- Custos de `order_items` protegidos contra acesso Seller.

## Preparado, sem integração externa

- Módulo Pedidos pronto para receber pedidos do site, mas sem entrada automática.
- Estrutura do `apps/site` preparada com interfaces e serviços substituíveis, ainda usando mocks em partes do fluxo.
- Fluxos de status, pagamento, separação, envio, rastreio e cancelamento de pedidos disponíveis no Admin.
- Compartilhamento pelo WhatsApp abre a conversa; não existe envio automático de PDF pela API oficial.

## Futuro / versão 2

- Ambiente de homologação independente.
- Baseline definitivo e reconciliação formal do schema.
- Organização das migrations em `supabase/migrations`.
- CI e testes automatizados.
- Integração Site → Admin com criação idempotente de pedidos.
- Reserva transacional de estoque.
- Pix e webhooks de pagamento.
- Melhor Envio e rastreio integrado.
- WhatsApp Business API e e-mails automáticos.
- PWA, melhorias profundas de UI/mobile, performance e acessibilidade.
- Avaliação futura da stack.

## Regras de negócio consolidadas

- Vendas e pedidos compartilham a sequência `operation_sequence`.
- Vendas e pedidos não são excluídos fisicamente.
- Cancelar venda devolve estoque e reverte o financeiro quando aplicável.
- Somente Admin pode cancelar venda e acessar custos, lucro, financeiro completo, auditoria e configurações.
- Seller possui acesso operacional sem custos internos.
- Produtos inativos permanecem no histórico, mas não aparecem nos seletores operacionais.
- `financial_entries` é o registro central do financeiro.
- Pedidos pagos baixam estoque e geram entrada financeira.
- Pedidos cancelados após pagamento devolvem estoque e revertem o financeiro.
- Pedidos entregues podem ser finalizados após sete dias.
- Recibos pertencem ao módulo Vendas; não existe módulo separado de Recibos.

## Segurança da migration 014

A migration `014_secure_order_items_and_login_redirect.sql` foi executada no Supabase e validada:

- policy antiga `order_items_authenticated_select` removida;
- SELECT direto de `order_items` limitado a Admin por `order_items_admin_select`;
- Seller usa `order_items_seller_view`;
- `unit_cost` e `total_cost` não são expostos na view operacional;
- Admin mantém acesso aos custos necessários;
- redirecionamentos externos no login são rejeitados;
- redirects internos conhecidos continuam permitidos.

## Migrations

- Os arquivos locais `001` a `014` são preservados como histórico do desenvolvimento.
- A migration 014 está aplicada.
- Existem dois arquivos com o número 013; eles não devem ser renomeados antes do baseline.
- O próximo número provisório local é 015.
- Nenhuma migration antiga deve ser reaplicada apenas com base no nome do arquivo.
- Mudanças futuras devem ser testadas primeiro em homologação.
- A reconciliação integral do schema real ainda não foi formalmente concluída.

## Documentos atuais

- `README.md` na raiz: visão geral e onboarding do monorepo.
- `RELEASE_V1.0.md`: escopo e checklist da versão em produção.
- `ROADMAP_V2.md`: fases planejadas para a próxima versão.
- `DATABASE_SCHEMA_AUDIT.md`: inventário local e pendências de baseline.
- `docs/`: arquitetura, banco, design e histórico de planejamento.

