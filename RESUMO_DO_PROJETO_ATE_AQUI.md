# Resumo do projeto — até aqui

_Atualizado em 17 de agosto de 2026._

## Visão geral

O repositório reúne a operação da **Veste Bem** em duas aplicações:

- `apps/admin`: painel administrativo v1.0 já utilizado na operação;
- `apps/site`: e-commerce em Next.js, ainda em desenvolvimento.

O projeto também contém uma área central de documentação e versionamento de banco em `database/` e uma Edge Function do Supabase em `supabase/functions/admin-users/`.

## O que já está consolidado no histórico

Os commits registrados são:

1. `d0f1e58` — criação inicial do projeto;
2. `8acac0d` — integração/configuração do Supabase;
3. `976735f` — finalização do sprint 8.

### Admin operacional (`apps/admin`)

O Admin v1.0 possui módulos de dashboard, produtos, estoque, clientes, vendas, pedidos online, financeiro, relatórios, auditoria, configurações e usuários. Também inclui recibo térmico, PDF, impressão e abertura de conversa no WhatsApp.

Ele usa Supabase para autenticação, banco, RLS, Storage e Edge Functions. Há perfis `admin` e `seller`, com permissões diferentes, e a função `admin-users` centraliza operações de usuários.

### E-commerce (`apps/site`)

O site é uma aplicação Next.js 16 com React 19 e TypeScript. A estrutura segue separação por domínio, aplicação, infraestrutura e apresentação.

Já existem as bases e telas para:

- página inicial e vitrine de produtos;
- carrinho persistido localmente;
- checkout com serviços simulados de endereço, frete e pagamento;
- criação e acompanhamento de pedidos locais/simulados;
- páginas institucionais e políticas;
- componentes compartilhados de navegação, layout, interface e feedback;
- integrações/repositórios de produto com Supabase e mocks.

## Trabalho em andamento (ainda não commitado)

O foco atual é um **painel específico para administrar os produtos exibidos no site**, separado do Admin operacional.

### Autenticação e proteção do painel do site

- Inclusão de `@supabase/ssr`;
- configuração de variáveis públicas do Supabase e da chave de serviço exclusiva do servidor;
- clientes Supabase para servidor, proxy e operações administrativas;
- entidade, repositório, serviço e actions de autenticação do administrador do site;
- rota de login em `/painel/login`;
- grupo de rotas protegidas em `/painel/(protected)`;
- proxy para controle de sessão e proteção de acesso.

### Gestão de produtos do site

- reorganização das rotas de painel para dashboard, lista de produtos e página de detalhes;
- formulário de configurações de publicação, destaque e SEO;
- ampliação da entidade/repositório de configurações do produto;
- galeria de mídia com operações de envio, ordenação e exclusão;
- ajustes nos repositórios Supabase de mídias, configurações e cores;
- melhorias de layout e estilos do painel e da página de detalhes do produto.

### Banco de dados documentado

Foi criada/atualizada a estrutura `database/` como fonte oficial das mudanças estruturais do projeto. Ela documenta tabelas, views, Storage e políticas para:

- configurações de exibição dos produtos no site;
- mídias/imagens de produtos;
- view de produtos para consumo pelo site;
- bucket e políticas de Storage de imagens;
- políticas de acesso, incluindo a correção da policy de cores de produto para vendedores.

Os SQLs dessa pasta **não são executados automaticamente**: precisam de revisão, validação no ambiente de testes, commit e autorização explícita antes de seguir ao banco principal.

## Limitações que continuam abertas

- pedidos do site ainda não entram automaticamente no Admin;
- Pix, webhooks e Melhor Envio ainda não foram integrados;
- e-mails automáticos não foram implementados;
- WhatsApp não envia PDFs automaticamente por API;
- falta ambiente formal de homologação e baseline definitivo do banco;
- PWA e melhorias profundas de experiência/mobile permanecem no roadmap v2.

## Estado atual do repositório

Há alterações locais pendentes de commit no `apps/site` e arquivos novos em `database/`. Antes de publicar ou integrar o trabalho, é recomendável executar em `apps/site`:

```bash
npm run lint
npm run typecheck
npm run build
```

Depois, revisar o diff, validar o fluxo de login e o gerenciamento de produtos do painel, e somente então criar o commit.
