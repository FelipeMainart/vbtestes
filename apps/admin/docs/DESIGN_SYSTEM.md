# Veste Bem Admin Design System

`assets/css/design-system.css` e a fonte canonica de tokens e componentes visuais do sistema. Ela deve ser carregada depois das folhas legadas.

## Regras

- Use apenas tokens `--ds-*` para cores, espacamento, raios, sombras e transicoes.
- Use classes `ds-*` em componentes novos.
- Cards usam `12px`; inputs, selects, botoes e dropdowns usam `10px`.
- Icones devem ser Lucide com `18px` e `stroke-width="2"`.
- Componentes nao devem receber cores, raios ou sombras locais.
- Variacoes visuais nao devem conter regras de negocio.

## Componentes

```html
<header class="ds-page-header">
  <div>
    <h1 class="ds-page-title">Produtos</h1>
    <p class="ds-page-header__description">Gerencie os produtos da loja.</p>
  </div>
  <button class="ds-button ds-button--primary" type="button">Novo produto</button>
</header>

<label class="ds-field">
  <span class="ds-label">Nome</span>
  <input class="ds-input" type="text" placeholder="Nome do produto">
</label>

<article class="ds-card">
  <h2 class="ds-card-title">Titulo do card</h2>
</article>

<span class="ds-badge ds-badge--active">Ativo</span>
<span class="ds-badge ds-badge--inactive">Inativo</span>
<span class="ds-badge ds-badge--low-stock">Estoque baixo</span>
<span class="ds-badge ds-badge--out-of-stock">Sem estoque</span>
```

## Contratos disponiveis

| Componente | Classes |
| --- | --- |
| Button | `ds-button`, `ds-button--primary`, `ds-button--secondary`, `ds-button--danger`, `ds-icon-button` |
| Form | `ds-field`, `ds-label`, `ds-input`, `ds-textarea`, `ds-native-select` |
| Select custom | `ds-select`, `ds-select__trigger`, `ds-select__menu`, `ds-select__option` |
| Dropdown | `ds-dropdown`, `ds-dropdown__item` |
| Card | `ds-card`, `ds-mini-card`, `ds-card-title` |
| Badge | `ds-badge` com variantes semanticas |
| Table | `ds-table-shell`, `ds-table` |
| Headers | `ds-page-header`, `ds-section-header` |
| Search | `ds-search` |
| Avatar | `ds-avatar` |
| Switch | `ds-switch` com `aria-checked` |
| Tabs | `ds-tabs`, `ds-tab` |
| Tooltip | `data-tooltip="Texto"` |
| Modal | `ds-modal-backdrop`, `ds-modal`, `ds-modal__header`, `ds-modal__actions` |
| Drawer | `ds-drawer-backdrop`, `ds-drawer` |
| Toast | `ds-toast-region`, `ds-toast` e variantes |
| Loading | `ds-loading` |
| Skeleton | `ds-skeleton` |
| Empty state | `ds-empty` |

Classes atuais como `button`, `form-field`, `status-badge`, `data-table`, `module-header`, `modal`, `reports-tabs` e `settings-tabs` ja recebem os mesmos tokens para manter compatibilidade durante a migracao gradual do markup.
