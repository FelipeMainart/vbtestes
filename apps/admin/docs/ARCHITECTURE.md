# Arquitetura Tecnica - Veste Bem Admin

Este documento define a arquitetura planejada para o MVP administrativo da Veste Bem. Ele nao implementa codigo; serve como referencia tecnica para as proximas fases.

## Objetivo do sistema

O Veste Bem Admin sera um painel interno para controlar a operacao da loja de coletes femininos. O MVP deve permitir:

- controle de produtos, variacoes e estoque;
- cadastro e historico de clientes;
- registro de vendas fisicas, WhatsApp e Instagram;
- processamento futuro de pedidos vindos do site;
- controle financeiro basico;
- relatorios gerenciais;
- auditoria de eventos criticos;
- geracao de recibos sob demanda dentro do modulo Vendas.

O MVP nao sera e-commerce, ERP completo, checkout online ou emissor fiscal.

## Tecnologias definidas

- Frontend: HTML, CSS e JavaScript puro.
- Backend: Supabase.
- Banco de dados: PostgreSQL via Supabase.
- Autenticacao: Supabase Auth.
- Permissoes: frontend + Supabase Row Level Security.
- Storage: Supabase Storage apenas para imagens de produtos.
- Deploy: Netlify ou Vercel.

## Camadas da aplicacao

### 1. Interface

A interface sera composta por paginas estaticas e componentes renderizados por JavaScript puro. A navegacao principal acontecera dentro do painel administrativo, com menu lateral fixo e area principal dinamica.

Paginas previstas:

- `login.html`: autenticacao de usuarios.
- `index.html`: painel autenticado.

Importante: essas paginas serao criadas apenas em fase futura. A FASE 2 nao cria telas.

### 2. Estilos

Os estilos serao separados por responsabilidade:

- base visual e variaveis;
- layout do painel;
- dashboard;
- formularios;
- tabelas;
- modais;
- impressao e recibos.

O visual deve ser moderno, minimalista, profissional e inspirado em sistemas administrativos como Bling, Tiny, Omie e Nuvemshop Admin. Nao deve seguir o estilo editorial do site de moda.

### 3. Aplicacao JavaScript

O JavaScript sera organizado em arquivos pequenos e modulares:

- inicializacao da aplicacao;
- autenticacao;
- cliente Supabase;
- roteamento interno;
- permissoes;
- utilitarios;
- auditoria;
- recibos;
- WhatsApp assistido;
- modulos de cada tela.

Nao havera framework no MVP, salvo decisao futura aprovada.

### 4. Backend e banco

O Supabase sera responsavel por:

- autenticacao;
- persistencia em PostgreSQL;
- RLS;
- storage de imagens de produtos;
- funcoes SQL para operacoes criticas;
- views especificas para ocultar custo e lucro de vendedores.

O banco deve proteger as regras de acesso independentemente do frontend.

## Modulos oficiais do MVP

O menu oficial do MVP tera:

1. Dashboard
2. Vendas
3. Pedidos
4. Produtos
5. Estoque
6. Clientes
7. Financeiro
8. Relatorios
9. Auditoria
10. Configuracoes

Nao existe menu Recibos. Recibos pertencem ao modulo Vendas.

## Regras arquiteturais obrigatorias

### Recibos

- Recibos ficam integrados ao modulo Vendas.
- O arquivo `pdfReceipt.js` pode existir como helper tecnico.
- Nao deve existir rota, menu ou modulo visual separado chamado Recibos.
- PDFs serao gerados sob demanda a partir dos dados da venda.
- PDFs nao serao salvos no Supabase Storage.

### Pedidos

- O modulo Pedidos sera uma central de acompanhamento e processamento.
- Nao deve haver botao "Novo Pedido" no fluxo normal.
- Pedidos serao criados futuramente pelo site/catalogo.
- No painel, a equipe podera processar status, pagamento, separacao, envio, rastreio e finalizacao.

### Permissoes

Existem dois perfis principais:

- Administrador: acesso total.
- Vendedor: acesso operacional limitado.

O frontend deve ocultar telas, botoes e campos restritos, mas a seguranca real deve estar no RLS.

Campos de custo, lucro, financeiro completo e auditoria devem ser protegidos para vendedores.

### Sequencia operacional unica

Vendas e pedidos compartilham a mesma numeracao operacional:

- Venda #00001
- Pedido #00002
- Venda #00003

Essa regra deve ser resolvida no banco para evitar conflito de concorrencia.

## Estrutura final de pastas proposta

```text
/
  index.html
  login.html
  README.md
  PROJECT_STATUS.md
  .env.example

/assets
  /css
    styles.css
    layout.css
    dashboard.css
    forms.css
    tables.css
    modals.css
    print.css
  /js
    app.js
    auth.js
    supabaseClient.js
    router.js
    utils.js
    permissions.js
    audit.js
    pdfReceipt.js
    whatsapp.js
    modules/
      dashboard.js
      sales.js
      orders.js
      products.js
      stock.js
      customers.js
      finance.js
      reports.js
      auditPage.js
      settings.js
  /img
    logo.png

/database
  /sql
    001_schema.sql
    002_rls.sql
    003_functions.sql
    004_views.sql
    005_seed.sql

/docs
  START_HERE.md
  Veste_Bem_Documento_Mestre_Codex_V3_1.md
  ARCHITECTURE.md
  DEVELOPMENT_PLAN.md
  DATABASE_MODEL.md
  SUPABASE_SETUP.md
  PHASES.md
```

## Padroes de nomenclatura

- Arquivos JavaScript: camelCase.
- Modulos de tela: nome do modulo em ingles, exemplo `sales.js`.
- SQL: prefixo numerico para ordem de execucao.
- Tabelas no banco: snake_case em ingles.
- Campos no banco: snake_case em ingles.
- Rotulos da interface: portugues do Brasil.

## Estrategia de evolucao

O projeto sera construido por fases aprovadas. Cada fase deve terminar com verificacao manual, atualizacao de status e parada para aprovacao antes da proxima fase.

## Decisoes de negocio oficializadas

### Vendas

- Administrador nao deve excluir vendas fisicamente.
- Venda pode ser cancelada.
- Venda cancelada permanece no banco, na auditoria e no historico.
- Venda cancelada deve devolver estoque quando aplicavel.
- Venda cancelada deve reverter lancamentos financeiros automaticos quando aplicavel.
- Status internos de venda no banco: `completed` e `cancelled`.
- Labels na interface: Concluida e Cancelada.
- Cancelamento de venda e exclusivo do Administrador.

### Pedidos

- Pedidos nao devem ser excluidos fisicamente.
- Pedidos nao terao botao "Novo Pedido" no painel.
- Status internos de pedido no banco: `awaiting_payment`, `paid`, `in_separation`, `awaiting_shipping`, `shipped`, `delivered`, `finalized` e `cancelled`.
- Labels em portugues ficam na interface.
- `orders.payment_status` usa `pending`, `paid`, `cancelled` e `refunded`.
- Apos permanecer 7 dias em `delivered`, o pedido deve mudar para `finalized`.
- Pedidos finalizados saem das pendencias operacionais e permanecem no historico.
- Pedido cancelado antes do pagamento gera apenas auditoria.

### Cliente Diversos

- `Cliente Diversos` e um registro padrao oficial do sistema.
- Quando o usuario nao quiser informar cliente, o sistema deve utilizar automaticamente `Cliente Diversos`.

### Produtos inativos

- Produto inativo nao aparece em vendas.
- Produto inativo nao aparece em pedidos.
- Produto inativo nao aparece em seletores operacionais.
- Produto inativo continua aparecendo em historico e relatorios.

### Financeiro

- Entradas automaticas: vendas e pedidos pagos.
- Entradas manuais: apenas administrador.
- `financial_entries` e a tabela central do financeiro.
- `expenses` guarda detalhes da despesa e deve se relacionar com `financial_entries`.
- Despesas: apenas administrador pode criar, editar ou excluir.

### Auditoria

Auditoria deve registrar obrigatoriamente:

- usuario;
- data;
- hora;
- acao;
- modulo;
- valor anterior;
- valor novo.

Eventos especialmente auditados:

- estoque;
- produtos;
- financeiro;
- pedidos;
- vendas;
- configuracoes.

### Numeracao operacional

- A numeracao operacional deve ser unica para todo o sistema.
- Exemplo: Venda #00001, Pedido #00002, Venda #00003, Pedido #00004.
- A tabela dedicada sera `operation_sequence`.
- Nao utilizar sequencias separadas para vendas e pedidos.
