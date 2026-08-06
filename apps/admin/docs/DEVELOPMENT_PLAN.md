# Plano de Desenvolvimento - Veste Bem Admin

Este plano organiza a execucao do MVP em fases. Nenhuma fase deve iniciar sem aprovacao explicita da fase anterior.

## Principios de desenvolvimento

- Seguir o documento mestre como fonte principal.
- Construir em fases pequenas e verificaveis.
- Evitar transformar o MVP em ERP completo.
- Separar responsabilidades por arquivo e modulo.
- Manter recibos dentro de Vendas.
- Manter Pedidos como modulo de processamento, sem criacao manual no painel.
- Aplicar permissoes no frontend e no Supabase RLS.
- Evitar dados fake permanentes e regras escondidas no frontend.

## Ordem aprovada das fases

### FASE 1 - Planejamento tecnico e arquitetura

Status: aprovada.

Entregas:

- leitura do documento mestre;
- entendimento do escopo;
- arquitetura proposta;
- estrutura final de pastas;
- ordem das proximas fases.

### FASE 2 - Documentacao tecnica do projeto

Status: em execucao neste momento.

Entregas:

- `docs/ARCHITECTURE.md`;
- `docs/DEVELOPMENT_PLAN.md`;
- `docs/SUPABASE_SETUP.md`;
- `docs/PHASES.md`;
- `README.md`;
- `PROJECT_STATUS.md`.

Restricoes:

- nao criar HTML;
- nao criar CSS;
- nao criar JavaScript funcional;
- nao criar SQL;
- nao criar banco;
- nao criar telas.

### FASE 3 - Banco de dados Supabase

Entregas previstas:

- documentacao tecnica completa da modelagem do banco;
- lista de tabelas, campos, tipos, obrigatoriedade e relacionamentos;
- estrategia de autenticacao;
- estrategia de RLS;
- estrategia de auditoria;
- estrategia de estoque;
- estrategia financeira.

Restricoes da primeira entrega da FASE 3:

- nao gerar SQL ainda;
- nao criar arquivos SQL ainda;
- nao criar triggers ainda;
- nao criar functions ainda;
- apresentar a modelagem completa para revisao antes da implementacao.

Entregas previstas apos aprovacao da modelagem:

- schema PostgreSQL;
- RLS;
- funcoes e triggers;
- views para vendedor sem custo/lucro;
- seed minimo operacional, incluindo Cliente Diversos e configuracoes iniciais.

Arquivos previstos:

- `docs/DATABASE_MODEL.md`;
- `database/sql/001_schema.sql`;
- `database/sql/002_rls.sql`;
- `database/sql/003_functions.sql`;
- `database/sql/004_views.sql`;
- `database/sql/005_seed.sql`.

### FASE 4 - Autenticacao e permissoes

Entregas previstas:

- login e logout;
- leitura de sessao Supabase;
- leitura de perfil;
- protecao de painel autenticado;
- permissoes de Administrador e Vendedor;
- ocultacao de recursos restritos no frontend.

Arquivos previstos:

- `login.html`;
- `assets/js/supabaseClient.js`;
- `assets/js/auth.js`;
- `assets/js/permissions.js`;
- ajustes em `index.html` quando existir.

### FASE 5 - Layout base do painel

Entregas previstas:

- `index.html`;
- menu lateral oficial;
- topo com busca, usuario e sair;
- area principal dinamica;
- padrao visual base;
- estilos de formularios, tabelas, botoes, badges e modais.

Arquivos previstos:

- `index.html`;
- `assets/css/styles.css`;
- `assets/css/layout.css`;
- `assets/css/forms.css`;
- `assets/css/tables.css`;
- `assets/css/modals.css`;
- `assets/js/app.js`;
- `assets/js/router.js`;
- `assets/js/utils.js`.

### FASE 6 - Modulos principais

Modulos:

- Dashboard;
- Produtos;
- Estoque;
- Clientes;
- Vendas.

Entregas previstas:

- indicadores principais;
- cadastro de produtos e variacoes;
- consulta e ajustes de estoque;
- cadastro de clientes;
- registro de vendas;
- baixa de estoque em vendas;
- entrada financeira automatica de vendas;
- cancelamento de vendas sem exclusao fisica;
- recibos sob demanda dentro de Vendas.

Arquivos previstos:

- `assets/js/modules/dashboard.js`;
- `assets/js/modules/products.js`;
- `assets/js/modules/stock.js`;
- `assets/js/modules/customers.js`;
- `assets/js/modules/sales.js`;
- `assets/js/pdfReceipt.js`;
- `assets/js/whatsapp.js`;
- `assets/js/audit.js`;
- `assets/css/dashboard.css`;
- `assets/css/print.css`.

### FASE 7 - Modulos avancados

Modulos:

- Pedidos;
- Financeiro;
- Relatorios;
- Auditoria;
- Configuracoes.

Entregas previstas:

- processamento de pedidos vindos do site;
- atualizacao de status de pedidos;
- finalizacao de pedidos entregues apos 7 dias;
- rastreio e mensagem WhatsApp assistida;
- financeiro completo para administrador;
- relatorios basicos;
- auditoria de eventos criticos;
- configuracoes da empresa e usuarios.

Arquivos previstos:

- `assets/js/modules/orders.js`;
- `assets/js/modules/finance.js`;
- `assets/js/modules/reports.js`;
- `assets/js/modules/auditPage.js`;
- `assets/js/modules/settings.js`.

## Criterios de pronto por fase

Cada fase deve:

- cumprir apenas seu escopo;
- nao antecipar implementacoes de fases futuras;
- atualizar `PROJECT_STATUS.md`;
- preservar decisoes aprovadas;
- parar e aguardar aprovacao.

## Pontos de atencao

- O nome correto do README sera `README.md`.
- O arquivo antigo `README.md.md` existe no projeto, mas nao e a referencia principal.
- Qualquer arquivo criado fora da fase aprovada deve ser evitado.
- Antes de implementar banco, sera necessario confirmar URL do Supabase, chaves publicas e politica de usuarios iniciais.
