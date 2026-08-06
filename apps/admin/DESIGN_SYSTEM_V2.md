# Veste Bem Design System V2

O V2 Ã© o padrÃ£o visual oficial do Admin. As telas `#/vendas`, `#/vendas/nova` e os drawers de visualizaÃ§Ã£o/recibo sÃ£o suas implementaÃ§Ãµes de referÃªncia. Os tokens e componentes canÃ´nicos ficam em `assets/css/design-system.css`; estilos novos devem reutilizar `--ds-*` e classes `ds-*`.

O V2 é o padrão visual oficial do Admin. A tela `#/vendas/nova` é sua implementação de referência. Os tokens e componentes canônicos ficam em `assets/css/design-system.css`; estilos novos devem reutilizar `--ds-*` e classes `ds-*`.

## Cores

| Papel | Token | Valor |
| --- | --- | --- |
| Azul-marinho principal | `--ds-color-primary` | `#0f2748` |
| Azul-marinho hover | `--ds-color-primary-hover` | `#183a67` |
| Sidebar | `--ds-color-sidebar` | `#081d30` |
| Sidebar profundo | `--ds-color-sidebar-deep` | `#061625` |
| Dourado | `--ds-color-gold` | `#c88a31` |
| Dourado hover | `--ds-color-gold-hover` | `#ad7124` |
| Dourado suave | `--ds-color-gold-soft` | `#fbf3e6` |
| Fundo / superfície | `--ds-color-background`, `--ds-color-surface` | `#ffffff` |
| Superfície secundária | `--ds-color-surface-secondary` | `#f8fafc` |
| Texto | `--ds-color-text` | `#0f172a` |
| Texto secundário | `--ds-color-text-secondary` | `#64748b` |
| Sucesso | `--ds-color-success` | `#16a34a` |
| Erro | `--ds-color-danger` | `#dc2626` |
| Alerta | `--ds-color-warning` | `#d97706` |

## Tipografia e medidas

- Família: Inter, Manrope, Segoe UI e fallbacks do sistema.
- Título de página: `--ds-font-page-title`; seção: `--ds-font-section-title`; card: `--ds-font-card-title`.
- Corpo: `--ds-font-body`; label: `--ds-font-label`; legenda e badge: `--ds-font-caption`.
- Escala de espaço: `--ds-space-1` a `--ds-space-12`.
- Cards: `--ds-radius-card` (12 px). Controles: `--ds-radius-control` (10 px).
- Transições: `--ds-transition` (180 ms). Respeitar `prefers-reduced-motion`.

## Componentes

- **Sidebar:** azul-marinho, ícone e texto claros, item ativo em gradiente dourado, usuário e presença no rodapé.
- **Header / Page title:** título direto, descrição breve e ação primária à direita.
- **Buttons:** `.ds-button`; variantes `--primary`, `--secondary`, `--gold`, `--outline-gold` e `--danger`.
- **Inputs / Select / Textarea:** altura de controle, borda neutra, foco marinho e raio padrão.
- **Dropdown:** menu branco com sombra overlay; itens com hover neutro.
- **Badge:** `.ds-badge` com variantes semânticas de ativo, inativo, alerta e erro.
- **Card:** `.ds-card`, borda sutil, superfície branca e sombra mínima.
- **List row / Expandable row:** linha inteira acionável; hover suave; seleção interna sem modal ou drawer.
- **Cart item:** imagem, identificação, variação, quantidade editável, subtotal e remoção.
- **Summary card:** subtotal, desconto e total dourado; campos operacionais abaixo.
- **Modal:** reservado a tarefas pontuais, confirmação e detalhes. Não usar para fluxos primários extensos.
- **Toast / feedback:** usar região `.ds-toast-region`; mensagens inline permanecem junto à ação quando exigem correção.
- **Empty state / Skeleton:** `.ds-empty` e `.ds-skeleton`.
- **Shortcut bar:** superfície dourada suave, atalhos agrupados e sem competir com a ação principal.

## Estados

- **Drawer:** painel lateral premium para detalhes de venda, recibo e ações secundárias; preferir em vez de modal para leitura e impressão.
- **Receipt template:** superfície branca com cabeçalho azul-marinho, blocos compactos, total em destaque e variantes de impressão A5 / 80 mm.

- **Hover:** alteração sutil de superfície/borda, entre 150 e 200 ms.
- **Active / selected:** borda ou fundo dourado; nunca depender apenas da cor para comunicar estado.
- **Disabled:** opacidade reduzida, cursor bloqueado e nenhuma transformação.
- **Loading:** skeleton para conteúdo estrutural; texto de progresso em ações transacionais.
- **Empty:** título curto e instrução acionável.
- **Error / success / warning:** tokens semânticos; não usar cores locais arbitrárias.

## Regras de aplicação

1. Não criar cores, raios, sombras ou durações fora dos tokens V2.
2. Reutilizar os contratos `.ds-*` antes de criar uma classe de módulo.
3. Classes de módulo podem controlar somente composição e layout; aparência deve vir dos tokens.
4. Fluxos operacionais longos usam página dedicada. Modais ficam restritos a detalhes e confirmações.
5. Ícones usam linguagem Lucide, 18 px e `stroke-width="2"` quando a biblioteca estiver disponível.
6. Desktop é a referência do PDV; notebook deve manter o carrinho utilizável; telas menores empilham o resumo.
7. Regras de negócio, permissões, RPCs e contratos de dados nunca pertencem à camada visual.

Este padrão deve orientar Clientes, Dashboard, Pedidos, Financeiro, Relatórios, Auditoria e Configurações nas próximas migrações.

## Configurações

Configurações usam um hub administrativo de cards com três colunas em desktop, duas em tablet e uma em mobile. Cada card tem ícone circular suave, título semibold, descrição curta, resumo e seta de navegação. As páginas internas usam breadcrumb, formulário em blocos, botão de salvar desabilitado até haver alterações e feedback por toast.

Campos seguem as alturas e bordas do Design System V2. A navegação interna da Empresa é vertical no desktop e vira uma grade compacta em telas menores. Estados indisponíveis devem indicar `Em breve` com clareza, sem simular integrações ou controles que não existem.
## Branding

- Arquivos oficiais ficam em `assets/branding/`.
- `logo-light`: usada em fundos escuros, como login e sidebar.
- `logo-dark`: usada em fundos claros, como dashboard, recibos e impressões.
- `logo-icon`: usada quando houver pouco espaço, como sidebar recolhida e fallback.
- O helper central fica em `assets/js/config/branding.js`.
- Para trocar a marca futuramente, altere os arquivos em `assets/branding/` ou o helper, sem espalhar caminhos pelo sistema.
# Segmented Control / Filtro de Período

O componente global está disponível em `assets/js/period.js` por meio de `renderPeriodSegmentedControl`, `bindPeriodSegmentedControl` e `getPeriodRange`.

Use-o em telas com indicadores temporais, com as opções `today`, `week` e `month`. O controle usa o dourado institucional no estado ativo, fundo neutro nas opções inativas, intervalo informativo ao lado e navegação por teclado com setas, Enter e Espaço. O cálculo considera o fuso local: hoje cobre o dia atual, semana começa na segunda-feira e mês cobre o primeiro ao último dia.

Dashboard, Pedidos Online, Financeiro e Relatórios usam o componente. Clientes permanece sem filtro temporal, pois a lista principal representa o cadastro completo. O comportamento responsivo empilha o intervalo abaixo do controle em telas estreitas e respeita `prefers-reduced-motion`.
## Sidebar Premium

No desktop, a Sidebar funciona como uma camada fixa abaixo da aplicacao. O conteudo e uma superficie branca elevada, com `border-radius: 22px 0 0 22px` e sombra suave aplicada somente nessa superficie. No estado recolhido, ela sobrepoe 14 px da Sidebar; em hover ou foco, o conteudo usa `transform: translateX()` para revelar o painel expandido.

As larguras permanecem em `--sidebar-collapsed-width` e `--sidebar-expanded-width`. A transicao usa 260 ms e `cubic-bezier(0.22, 1, 0.36, 1)`, priorizando `transform`, `opacity` e `width`. A logo completa e os textos do rodape fazem fade com pequeno deslocamento apos a expansao; o icone da marca permanece no estado recolhido. O item ativo continua dourado com sombra discreta. Em telas ate 900 px, o comportamento de drawer e overlay existente e preservado sem o efeito de camadas.
## Relatorios

O centro de Relatorios usa paginas internas em tres niveis: visao geral, categoria e detalhe. Cada nivel usa breadcrumb em vez de drawer, o Segmented Control global e cards compactos com icones outline. Categorias usam grade de tres colunas no desktop, duas no tablet e uma no mobile. Acoes de exportacao, CSV e impressao usam os mesmos botoes compactos do sistema.
