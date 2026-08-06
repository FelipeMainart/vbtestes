# Veste Bem Admin

Sistema administrativo interno da Veste Bem, loja especializada em coletes femininos.

Este projeto sera construido em fases, seguindo o documento mestre:

- `docs/Veste_Bem_Documento_Mestre_Codex_V3_1.md`

## Escopo do MVP

O MVP sera um painel administrativo para:

- controlar produtos, variacoes e estoque;
- cadastrar clientes;
- registrar vendas fisicas, WhatsApp e Instagram;
- gerar recibos sob demanda dentro de Vendas;
- processar pedidos vindos futuramente do site;
- controlar financeiro basico;
- gerar relatorios;
- registrar auditoria para eventos criticos.

O MVP nao sera e-commerce, ERP completo, checkout online ou emissor fiscal.

## Tecnologias

- HTML
- CSS
- JavaScript puro
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- Netlify ou Vercel

## Regras importantes

- Nao existe menu Recibos.
- Recibos ficam integrados ao modulo Vendas.
- `pdfReceipt.js` podera existir apenas como helper tecnico.
- O modulo Pedidos nao deve ter botao "Novo Pedido".
- Pedidos serao criados futuramente pelo site e apenas processados no painel.
- Vendas e pedidos compartilham sequencia operacional unica.
- A numeracao usa `operation_sequence`, sem sequencias separadas para vendas e pedidos.
- Vendas e pedidos nao sao excluidos fisicamente.
- Vendas usam status internos `completed` e `cancelled`; a interface exibe Concluida e Cancelada.
- Pedidos usam status internos em ingles/snake_case; a interface exibe os labels operacionais em portugues.
- Cancelamento de venda e exclusivo do Administrador.
- Pedido cancelado antes do pagamento gera apenas auditoria, sem lancamento financeiro.
- `financial_entries` e a tabela central do financeiro.
- O primeiro administrador sera criado manualmente no Supabase Auth e registrado depois em `profiles`.
- `Cliente Diversos` e registro padrao oficial para vendas sem identificacao do cliente.
- Produtos inativos nao aparecem em seletores operacionais, mas permanecem em historico e relatorios.
- Vendedores nao podem acessar custo, lucro, financeiro completo ou auditoria.

## Fases

1. Planejamento tecnico e arquitetura.
2. Documentacao tecnica do projeto.
3. Banco de dados Supabase.
4. Autenticacao e permissoes.
5. Layout base do painel.
6. Modulos principais: Dashboard, Produtos, Estoque, Clientes e Vendas.
7. Modulos avancados: Pedidos, Financeiro, Relatorios, Auditoria e Configuracoes.

Detalhes em:

- `docs/PHASES.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/DATABASE_MODEL.md`
- `docs/SUPABASE_SETUP.md`

## Status atual

Consulte:

- `PROJECT_STATUS.md`
