# Fases do Projeto - Veste Bem Admin

Este documento registra a ordem oficial aprovada para desenvolvimento do MVP.

## Regra geral

Cada fase deve ser executada isoladamente. Ao concluir uma fase, o trabalho deve parar e aguardar aprovacao antes de seguir.

## FASE 1 - Planejamento tecnico e arquitetura

Status: aprovada.

Escopo:

- ler documentacao mestre;
- propor arquitetura;
- propor estrutura final de pastas;
- organizar modulos;
- definir estrategia de Supabase;
- definir sequencia das proximas fases.

Nao inclui implementacao.

## FASE 2 - Criar documentacao tecnica do projeto

Status: em andamento.

Arquivos:

- `docs/ARCHITECTURE.md`;
- `docs/DEVELOPMENT_PLAN.md`;
- `docs/SUPABASE_SETUP.md`;
- `docs/PHASES.md`;
- `README.md`;
- `PROJECT_STATUS.md`.

Nao criar:

- HTML;
- CSS;
- JavaScript funcional;
- SQL;
- banco de dados;
- telas.

## FASE 3 - Criar banco de dados Supabase

Escopo:

- primeiro criar documentacao completa da modelagem do banco;
- listar tabelas, campos, tipos, obrigatoriedade e relacionamentos;
- definir autenticacao, RLS, auditoria, estoque e financeiro;
- aguardar aprovacao antes de gerar SQL.

Nao criar nesta primeira entrega da FASE 3:

- arquivos SQL;
- banco de dados;
- triggers;
- functions.

Arquivos previstos:

- `docs/DATABASE_MODEL.md`;
- `database/sql/001_schema.sql`;
- `database/sql/002_rls.sql`;
- `database/sql/003_functions.sql`;
- `database/sql/004_views.sql`;
- `database/sql/005_seed.sql`.

## FASE 4 - Criar autenticacao e permissoes

Escopo:

- login;
- logout;
- sessao Supabase;
- leitura de perfil;
- permissoes de Admin e Vendedor;
- bloqueios de acesso;
- ocultacao de campos e acoes restritas.

## FASE 5 - Criar layout base do painel

Escopo:

- painel base;
- menu lateral;
- topo;
- area principal;
- estilos globais;
- componentes visuais comuns.

## FASE 6 - Criar modulos principais

Modulos:

- Dashboard;
- Produtos;
- Estoque;
- Clientes;
- Vendas.

Regras importantes:

- Vendas deve registrar operacoes finalizadas;
- Vendas deve baixar estoque;
- Vendas deve registrar financeiro;
- venda pode ser cancelada, mas nunca excluida fisicamente;
- venda cancelada permanece no banco, historico e auditoria;
- labels oficiais de venda na interface: Concluida e Cancelada;
- no banco, os status de venda sao `completed` e `cancelled`;
- cancelamento de venda e exclusivo do Administrador;
- Recibos ficam dentro de Vendas;
- nao existe menu Recibos.

## FASE 7 - Criar modulos avancados

Modulos:

- Pedidos;
- Financeiro;
- Relatorios;
- Auditoria;
- Configuracoes.

Regras importantes:

- Pedidos nao deve ter botao "Novo Pedido";
- pedidos serao criados futuramente pelo site;
- o painel apenas processa e acompanha pedidos;
- pedidos nao devem ser excluidos fisicamente;
- labels oficiais na interface: Aguardando Pagamento, Pago, Em Separacao, Aguardando Envio, Enviado, Entregue, Finalizado e Cancelado;
- no banco, os status sao `awaiting_payment`, `paid`, `in_separation`, `awaiting_shipping`, `shipped`, `delivered`, `finalized` e `cancelled`;
- `payment_status` usa `pending`, `paid`, `cancelled` e `refunded`;
- pedidos em `delivered` por 7 dias devem mudar para `finalized`;
- pedido cancelado antes do pagamento gera apenas auditoria;
- pedidos finalizados saem das pendencias operacionais e permanecem no historico;
- `financial_entries` e a tabela central do financeiro;
- `expenses` guarda o detalhe da despesa e se relaciona com `financial_entries`;
- Auditoria e Configuracoes sao exclusivas do administrador.

## Marcos de aceite do MVP

O MVP completo sera aceito quando:

- login funcionar com admin e vendedor;
- permissoes funcionarem;
- produto com variacoes puder ser cadastrado;
- estoque puder ser consultado e ajustado;
- venda puder ser registrada;
- venda baixar estoque;
- venda registrar financeiro;
- venda gerar recibo sob demanda;
- administrador puder editar/cancelar venda;
- cliente puder ser cadastrado;
- pedido puder ser visualizado e processado quando criado no banco;
- pedido pago baixar estoque e registrar financeiro;
- dashboard mostrar indicadores e pendencias de envio;
- financeiro mostrar entradas e despesas;
- relatorios basicos funcionarem;
- auditoria registrar eventos criticos;
- backup CSV basico funcionar.
