import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';

const availableSizes = ['PP', 'P', 'M', 'G', 'GG'];

const stockState = {
  products: [],
  profile: null,
  isAdmin: false,
  expandedProducts: new Set(),
  filters: {
    search: '',
    status: 'all',
    sort: 'name-asc',
    perPage: '20',
  },
  page: 1,
  movement: {
    product: null,
    color: null,
    variation: null,
  },
  history: {
    movements: [],
    filter: 'all',
    scope: null,
  },
  abortController: null,
};

const stockStatusLabels = {
  ok: 'Normal',
  low: 'Baixo estoque',
  out: 'Sem estoque',
  inactive: 'Inativo',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getImagePlaceholder() {
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="8" fill="%23e2e8f0"/><text x="48" y="53" text-anchor="middle" font-size="11" fill="%2364748b">sem foto</text></svg>';
}

function getVariationStatus(variation) {
  const quantity = Number(variation.quantity || 0);
  const minimumStock = Number(variation.minimum_stock || 0);

  if (quantity <= 0) return 'out';
  if (quantity <= minimumStock) return 'low';
  return 'ok';
}

function calculateColorTotals(color) {
  const activeVariations = (color.variations || []).filter((variation) => variation.status !== 'inactive');
  return {
    variationCount: activeVariations.length,
    stockTotal: activeVariations.reduce((total, variation) => total + Number(variation.quantity || 0), 0),
  };
}

function calculateProductTotals(product) {
  const colors = product.colors || [];
  const activeColors = colors.filter((color) => color.active !== false);
  const variations = activeColors.flatMap((color) => (color.variations || []).filter((variation) => variation.status !== 'inactive'));
  const statuses = variations.map(getVariationStatus);
  let status = 'ok';

  if (!variations.length || statuses.includes('out')) {
    status = 'out';
  } else if (statuses.includes('low')) {
    status = 'low';
  }

  return {
    colorCount: activeColors.length,
    variationCount: variations.length,
    stockTotal: variations.reduce((total, variation) => total + Number(variation.quantity || 0), 0),
    status,
  };
}

function getProductReference(product) {
  return String(product?.sku || '').replace(/^(?:ref\.?\s*:?\s*)+/i, '').trim();
}

function getStockStatusClass(status) {
  if (status === 'out') return 'status-badge--out-of-stock';
  if (status === 'low') return 'status-badge--warning';
  if (status === 'inactive') return 'status-badge--inactive';
  return 'status-badge--active';
}

function formatPieces(quantity) {
  const value = Number(quantity || 0);
  return `${value} ${value === 1 ? 'peça' : 'peças'}`;
}

function getProductStockStatus(product) {
  if (product.status === 'inactive') return 'inactive';
  return calculateProductTotals(product).status;
}

function getFilteredProducts() {
  const search = stockState.filters.search.trim().toLowerCase();

  return stockState.products.filter((product) => {
    const reference = getProductReference(product).toLowerCase();
    const matchesColorSearch = (product.colors || []).some((color) => String(color.name || '').toLowerCase().includes(search));
    const matchesSearch = !search
      || product.name.toLowerCase().includes(search)
      || reference.includes(search)
      || matchesColorSearch;
    const matchesStatus = stockState.filters.status === 'all' || getProductStockStatus(product) === stockState.filters.status;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const sort = stockState.filters.sort;
    if (sort === 'name-desc') return b.name.localeCompare(a.name, 'pt-BR');
    if (sort === 'stock-desc') return calculateProductTotals(b).stockTotal - calculateProductTotals(a).stockTotal;
    if (sort === 'stock-asc') return calculateProductTotals(a).stockTotal - calculateProductTotals(b).stockTotal;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

async function loadAdminStock() {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, status, sku')
    .order('name', { ascending: true });

  if (productsError) throw productsError;

  const productIds = (products || []).map((product) => product.id);
  let colors = [];
  let variations = [];

  if (productIds.length) {
    const { data: colorsData, error: colorsError } = await supabase
      .from('product_colors')
      .select('id, product_id, color_name, image_url, active')
      .in('product_id', productIds)
      .order('color_name', { ascending: true });

    if (colorsError) throw colorsError;
    colors = colorsData || [];

    const { data: variationsData, error: variationsError } = await supabase
      .from('product_variations')
      .select('id, product_id, product_color_id, size, quantity, minimum_stock, status')
      .in('product_id', productIds);

    if (variationsError) throw variationsError;
    variations = variationsData || [];
  }

  return composeStockProducts(products || [], colors, variations);
}

async function loadSellerStock() {
  const { data: stockRows, error } = await supabase
    .from('vw_stock_seller')
    .select('variation_id, product_id, product_name, product_color_id, color_name, color_image_url, color_active, size, quantity, minimum_stock, variation_status')
    .order('product_name', { ascending: true });

  if (error) throw error;

  return composeSellerStock(stockRows || []);
}

function composeStockProducts(products, colors, variations) {
  const colorsByProduct = new Map();
  const variationsByColor = new Map();

  colors.forEach((color) => {
    const normalizedColor = {
      id: color.id,
      product_id: color.product_id,
      name: color.color_name,
      imageUrl: color.image_url,
      active: color.active,
      variations: [],
    };

    if (!colorsByProduct.has(color.product_id)) colorsByProduct.set(color.product_id, []);
    colorsByProduct.get(color.product_id).push(normalizedColor);
    variationsByColor.set(color.id, normalizedColor.variations);
  });

  variations.forEach((variation) => {
    const target = variationsByColor.get(variation.product_color_id);
    if (!target) return;

    target.push({
      id: variation.id,
      product_id: variation.product_id,
      product_color_id: variation.product_color_id,
      size: variation.size,
      quantity: Number(variation.quantity || 0),
      minimum_stock: Number(variation.minimum_stock || 0),
      status: variation.status,
    });
  });

  return products.map((product) => ({
    ...product,
    colors: colorsByProduct.get(product.id) || [],
  }));
}

function composeSellerStock(stockRows) {
  const productsById = new Map();

  stockRows.forEach((row) => {
    if (!productsById.has(row.product_id)) {
      productsById.set(row.product_id, {
        id: row.product_id,
        name: row.product_name,
        status: 'active',
        colors: [],
      });
    }

    const product = productsById.get(row.product_id);
    let color = product.colors.find((item) => item.id === row.product_color_id);

    if (!color) {
      color = {
        id: row.product_color_id,
        product_id: row.product_id,
        name: row.color_name,
        imageUrl: row.color_image_url,
        active: row.color_active,
        variations: [],
      };
      product.colors.push(color);
    }

    color.variations.push({
      id: row.variation_id,
      product_id: row.product_id,
      product_color_id: row.product_color_id,
      size: row.size,
      quantity: Number(row.quantity || 0),
      minimum_stock: Number(row.minimum_stock || 0),
      status: row.variation_status,
    });
  });

  return [...productsById.values()];
}

async function loadStock(container) {
  setStockLoading(container);

  try {
    stockState.products = stockState.isAdmin
      ? await loadAdminStock()
      : await loadSellerStock();
    renderStockList(container);
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
    setStockError(container, 'Não foi possível carregar o estoque.');
  }
}

function renderStockLayout(container, route) {
  container.innerHTML = `
    <section class="module-panel stock-module" aria-labelledby="stock-title">
      <div class="module-header">
        <div>
          <h2 id="stock-title">${escapeHtml(route.title)}</h2>
          <p class="module-panel__text">Centro operacional de saldos e movimentações.</p>
        </div>
      </div>

      <div class="stock-summary-grid" data-stock-summary>
        ${Array.from({ length: 5 }, () => '<div class="ds-skeleton"></div>').join('')}
      </div>

      <form class="stock-toolbar" data-stock-filters>
        <label class="stock-search-field">
          <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" name="search" placeholder="Buscar produto..." autocomplete="off" />
        </label>

        <label class="stock-filter-field" data-stock-filter-field="status">
          <span>Status</span>
          <input type="hidden" name="status" value="all" />
          <button class="stock-filter-control" type="button" data-stock-filter-trigger="status"><b data-stock-filter-label="status">Todos</b><i aria-hidden="true"></i></button>
          <div class="stock-filter-menu" data-stock-filter-menu="status"></div>
        </label>

        <label class="stock-filter-field" data-stock-filter-field="sort">
          <span>Ordenar por</span>
          <input type="hidden" name="sort" value="name-asc" />
          <button class="stock-filter-control" type="button" data-stock-filter-trigger="sort"><b data-stock-filter-label="sort">Nome A-Z</b><i aria-hidden="true"></i></button>
          <div class="stock-filter-menu" data-stock-filter-menu="sort"></div>
        </label>

        <label class="stock-filter-field" data-stock-filter-field="perPage">
          <span>Mostrar</span>
          <input type="hidden" name="perPage" value="20" />
          <button class="stock-filter-control" type="button" data-stock-filter-trigger="perPage"><b data-stock-filter-label="perPage">20 por página</b><i aria-hidden="true"></i></button>
          <div class="stock-filter-menu" data-stock-filter-menu="perPage"></div>
        </label>
      </form>

      <div class="stock-list-meta">
        <p data-stock-results>Carregando produtos...</p>
      </div>

      <div class="stock-products-list" data-stock-list>
        <p class="table-empty">Carregando estoque...</p>
      </div>

      <nav class="stock-pagination" data-stock-pagination aria-label="Paginação do estoque"></nav>
    </section>

    <div class="modal-backdrop" data-stock-modal hidden>
      <section class="modal modal--wide stock-movement-modal" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title">
        <form class="stock-movement-form" data-stock-form>
          <div class="modal__header">
            <div>
              <p class="eyebrow">Estoque</p>
              <h3 id="stock-modal-title">Movimentar estoque</h3>
              <p>Registre uma entrada, saída ou ajuste manual.</p>
            </div>
            <button class="icon-button" type="button" data-close-stock-modal aria-label="Fechar"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
          </div>

          <div class="movement-summary" data-movement-summary></div>

          <div class="stock-movement-grid">
            <select name="variation_id" data-movement-variation hidden></select>

            <fieldset class="stock-size-picker">
              <legend>Tamanho</legend>
              <div data-movement-size-options></div>
              <small data-stock-size-feedback>Selecione o tamanho que será movimentado.</small>
            </fieldset>

            <fieldset class="stock-movement-type">
              <legend>Tipo de movimentação</legend>
              <select name="movement_type" data-movement-type hidden>
                <option value="entry">Entrada</option>
                <option value="exit">Saída</option>
                <option value="adjustment">Ajuste</option>
              </select>
              <div>
                <button type="button" data-movement-type-option="entry"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>Entrada</button>
                <button type="button" data-movement-type-option="exit"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>Saída</button>
                <button type="button" data-movement-type-option="adjustment"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>Ajuste</button>
              </div>
            </fieldset>

            <label class="form-field stock-quantity-field">
              <span data-quantity-label>Quantidade</span>
              <div class="stock-quantity-stepper">
                <button type="button" data-stock-quantity-step="-1" aria-label="Diminuir quantidade">−</button>
                <input name="quantity" type="number" min="0" step="1" required />
                <button type="button" data-stock-quantity-step="1" aria-label="Aumentar quantidade">+</button>
              </div>
              <small class="stock-quantity-feedback" data-stock-quantity-feedback>Informe uma quantidade maior que zero.</small>
            </label>

            <fieldset class="stock-reason-picker">
              <legend>Motivo</legend>
              <select name="reason_option" data-stock-reason-option hidden>
                <option value="Venda">Venda</option><option value="Compra">Compra</option><option value="Reposição">Reposição</option><option value="Inventário">Inventário</option><option value="Perda">Perda</option><option value="Troca">Troca</option><option value="other">Outros</option>
              </select>
              <div>
                <button type="button" data-stock-reason-value="Compra">Compra</button>
                <button type="button" data-stock-reason-value="Venda">Venda</button>
                <button type="button" data-stock-reason-value="Reposição">Reposição</button>
                <button type="button" data-stock-reason-value="Inventário">Inventário</button>
                <button type="button" data-stock-reason-value="Perda">Perda</button>
                <button type="button" data-stock-reason-value="Troca">Troca</button>
                <button type="button" data-stock-reason-value="other">Outros</button>
              </div>
            </fieldset>

            <label class="form-field stock-reason-details" data-stock-reason-details hidden>
              <span>Detalhes do motivo</span>
              <textarea name="reason" rows="3" required placeholder="Descreva o motivo da movimentação"></textarea>
            </label>

            <input name="current_quantity" type="hidden" />
          </div>

          <section class="stock-movement-preview" aria-live="polite" data-stock-movement-preview></section>

          <p class="form-message" data-stock-message></p>

          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-close-stock-modal>Cancelar</button>
            <button class="button button--primary" type="submit" data-stock-submit disabled><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Confirmar movimentação</button>
          </div>
        </form>
      </section>
    </div>

    <div class="modal-backdrop" data-stock-history-modal hidden>
      <section class="modal modal--wide stock-history-modal" role="dialog" aria-modal="true" aria-labelledby="stock-history-title">
        <div class="modal__content">
          <div class="modal__header">
            <div>
              <p class="eyebrow">Estoque</p>
              <h3 id="stock-history-title">Histórico de estoque</h3>
              <p data-stock-history-subtitle>Movimentações registradas para este item.</p>
            </div>
            <button class="icon-button" type="button" data-close-stock-history aria-label="Fechar"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
          </div>

          <div class="stock-history-filters" role="tablist" aria-label="Filtrar movimentações">
            <button class="is-active" type="button" data-stock-history-filter="all">Todas</button>
            <button type="button" data-stock-history-filter="entry">Entrada</button>
            <button type="button" data-stock-history-filter="exit">Saída</button>
            <button type="button" data-stock-history-filter="adjustment">Ajuste</button>
          </div>

          <div class="stock-history-columns" aria-hidden="true">
            <span>Data/hora</span><span>Produto</span><span>Tipo</span><span>Quantidade</span><span>Motivo</span><span>Usuário</span>
          </div>
          <div class="stock-history-list" data-stock-history-list>
            <div class="ds-loading">Carregando movimentações...</div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function setStockLoading(container) {
  const list = container.querySelector('[data-stock-list]');
  if (list) list.innerHTML = '<p class="table-empty">Carregando estoque...</p>';
}

function setStockError(container, message) {
  const list = container.querySelector('[data-stock-list]');
  if (list) list.innerHTML = `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function getVariationContext(variationId) {
  for (const product of stockState.products) {
    for (const color of product.colors || []) {
      const variation = (color.variations || []).find((item) => item.id === variationId);
      if (variation) return { product, color, variation };
    }
  }
  return { product: null, color: null, variation: null };
}

function formatMovementDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((today - target) / 86400000);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (daysAgo === 0) return `Hoje, ${time}`;
  if (daysAgo === 1) return `Ontem, ${time}`;
  return `${date.toLocaleDateString('pt-BR')}, ${time}`;
}

function getMovementPresentation(movement) {
  const type = movement.movement_type;
  const positiveTypes = new Set(['entry', 'cancel_sale', 'cancel_order']);
  const negativeTypes = new Set(['exit', 'sale', 'order']);
  const labels = {
    entry: 'Entrada',
    exit: 'Saída',
    adjustment: 'Ajuste',
    sale: 'Venda',
    order: 'Pedido',
    cancel_sale: 'Cancelamento de venda',
    cancel_order: 'Cancelamento de pedido',
  };

  if (type === 'adjustment') {
    return { tone: 'adjustment', label: labels[type], quantity: `→ ${movement.new_quantity}` };
  }
  if (positiveTypes.has(type)) {
    return { tone: 'entry', label: labels[type] || type, quantity: `+${movement.quantity}` };
  }
  if (negativeTypes.has(type)) {
    return { tone: 'exit', label: labels[type] || type, quantity: `-${movement.quantity}` };
  }
  return { tone: 'adjustment', label: labels[type] || type, quantity: String(movement.quantity) };
}

async function fetchStockMovements(variationIds) {
  const ids = [...new Set((variationIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('id, variation_id, movement_type, quantity, previous_quantity, new_quantity, reason, created_by, created_at')
    .in('variation_id', ids)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  const profileIds = [...new Set((movements || []).map((movement) => movement.created_by).filter(Boolean))];
  let profiles = [];
  if (profileIds.length) {
    const { data, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', profileIds);
    if (profilesError) console.warn('Não foi possível carregar autores das movimentações:', profilesError.message);
    profiles = data || [];
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile.name]));
  return (movements || []).map((movement) => ({
    ...movement,
    ...getVariationContext(movement.variation_id),
    userName: profilesById.get(movement.created_by) || 'Sistema',
  }));
}

function renderMovementHistoryRows(movements) {
  if (!movements.length) {
    return `
      <div class="stock-history-empty">
        <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
        <p>Nenhuma movimentação registrada para este item.</p>
      </div>
    `;
  }

  return movements.map((movement) => {
    const presentation = getMovementPresentation(movement);
    return `
      <article class="stock-history-row stock-history-row--${presentation.tone}">
        <time>${escapeHtml(formatMovementDate(movement.created_at))}</time>
        <div><strong>${escapeHtml(movement.product?.name || 'Produto')}</strong><small>${escapeHtml(movement.color?.name || '-')} · ${escapeHtml(movement.variation?.size || '-')}</small></div>
        <span class="stock-history-type">${escapeHtml(presentation.label)}</span>
        <strong class="stock-history-quantity">${escapeHtml(presentation.quantity)}</strong>
        <span>${escapeHtml(movement.reason || '-')}</span>
        <small>${escapeHtml(movement.userName)}</small>
      </article>
    `;
  }).join('');
}

function getHistoryScope(productId, colorId = '', variationId = '') {
  const product = getProductById(productId);
  const color = colorId ? getColorById(product, colorId) : null;
  const variation = variationId ? getVariationById(color, variationId) : null;
  const variationIds = variation
    ? [variation.id]
    : color
      ? (color.variations || []).map((item) => item.id)
      : (product?.colors || []).flatMap((item) => (item.variations || []).map((entry) => entry.id));

  return { product, color, variation, variationIds };
}

function renderStockHistoryModal(container) {
  const target = container.querySelector('[data-stock-history-list]');
  if (!target) return;

  const filter = stockState.history.filter;
  const movements = filter === 'all'
    ? stockState.history.movements
    : stockState.history.movements.filter((movement) => getMovementPresentation(movement).tone === filter);

  container.querySelectorAll('[data-stock-history-filter]').forEach((button) => {
    const isSelected = button.dataset.stockHistoryFilter === filter;
    button.classList.toggle('is-active', isSelected);
    button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
  target.innerHTML = renderMovementHistoryRows(movements);
}

async function openStockHistoryModal(container, productId, colorId = '', variationId = '') {
  const modal = container.querySelector('[data-stock-history-modal]');
  const subtitle = container.querySelector('[data-stock-history-subtitle]');
  const target = container.querySelector('[data-stock-history-list]');
  const scope = getHistoryScope(productId, colorId, variationId);
  if (!scope.product || !scope.variationIds.length) return;

  stockState.history = { movements: [], filter: 'all', scope };
  const scopeLabel = scope.variation
    ? `${scope.product.name} · ${scope.color?.name || ''} · tamanho ${scope.variation.size}`
    : scope.color
      ? `${scope.product.name} · ${scope.color.name}`
      : scope.product.name;
  subtitle.textContent = `Movimentações registradas para ${scopeLabel}.`;
  target.innerHTML = '<div class="ds-loading">Carregando movimentações...</div>';
  modal.hidden = false;

  try {
    const movements = await fetchStockMovements(scope.variationIds);
    if (stockState.history.scope !== scope) return;
    stockState.history.movements = movements;
    renderStockHistoryModal(container);
  } catch (error) {
    console.error('Erro ao carregar histórico de estoque:', error);
    target.innerHTML = '<p class="stock-history-error">Não foi possível carregar o histórico de estoque.</p>';
  }
}

function closeStockHistoryModal(container) {
  container.querySelector('[data-stock-history-modal]').hidden = true;
  stockState.history = { movements: [], filter: 'all', scope: null };
}

function renderStockSummary(container) {
  const target = container.querySelector('[data-stock-summary]');
  if (!target) return;

  const totals = stockState.products.reduce((summary, product) => {
    const productTotals = calculateProductTotals(product);
    summary.variations += productTotals.variationCount;
    summary.stock += productTotals.stockTotal;
    if (productTotals.status === 'low') summary.low += 1;
    if (productTotals.status === 'out') summary.out += 1;
    return summary;
  }, { variations: 0, stock: 0, low: 0, out: 0 });

  const cards = [
    { label: 'Produtos cadastrados', value: stockState.products.length, description: 'ativos', tone: 'package', icon: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>' },
    { label: 'Variações', value: totals.variations, description: 'combinações', tone: 'layers', icon: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>' },
    { label: 'Peças em estoque', value: totals.stock, description: 'unidades', tone: 'boxes', icon: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/><path d="M8 12v5l4 2 4-2v-5"/>' },
    { label: 'Produtos com estoque baixo', value: totals.low, description: 'atenção', tone: 'warning', icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
    { label: 'Produtos sem estoque', value: totals.out, description: 'críticos', tone: 'danger', icon: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>' },
  ];

  target.innerHTML = cards.map((card) => `
    <article class="stock-summary-card stock-summary-card--${card.tone}">
      <span class="stock-summary-card__icon"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true">${card.icon}</svg></span>
      <div><span>${escapeHtml(card.label)}</span><strong>${Number(card.value || 0).toLocaleString('pt-BR')}</strong><small>${escapeHtml(card.description)}</small></div>
    </article>
  `).join('');
}

function renderStockFilterMenu(container, name, options, currentValue) {
  const input = container.querySelector(`[name="${name}"]`);
  const label = container.querySelector(`[data-stock-filter-label="${name}"]`);
  const menu = container.querySelector(`[data-stock-filter-menu="${name}"]`);
  const selected = options.find((option) => option.value === currentValue) || options[0];

  if (input) input.value = selected.value;
  if (label) label.textContent = selected.label;
  if (!menu) return;

  menu.innerHTML = options.map((option) => `
    <button class="${option.value === selected.value ? 'is-selected' : ''}" type="button" data-stock-filter-option="${name}" data-value="${escapeHtml(option.value)}">
      ${escapeHtml(option.label)}
    </button>
  `).join('');
}

function renderStockFilters(container) {
  renderStockFilterMenu(container, 'status', [
    { value: 'all', label: 'Todos' },
    { value: 'ok', label: 'Normal' },
    { value: 'low', label: 'Baixo estoque' },
    { value: 'out', label: 'Sem estoque' },
    { value: 'inactive', label: 'Inativo' },
  ], stockState.filters.status);
  renderStockFilterMenu(container, 'sort', [
    { value: 'name-asc', label: 'Nome A-Z' },
    { value: 'name-desc', label: 'Nome Z-A' },
    { value: 'stock-desc', label: 'Maior estoque' },
    { value: 'stock-asc', label: 'Menor estoque' },
  ], stockState.filters.sort);
  renderStockFilterMenu(container, 'perPage', [
    { value: '10', label: '10 por página' },
    { value: '20', label: '20 por página' },
    { value: '50', label: '50 por página' },
  ], stockState.filters.perPage);
}

function closeStockFilterMenus(container, exceptName = '') {
  container.querySelectorAll('[data-stock-filter-field]').forEach((field) => {
    field.classList.toggle('is-open', field.dataset.stockFilterField === exceptName);
  });
}

function renderStockList(container) {
  const list = container.querySelector('[data-stock-list]');
  const results = container.querySelector('[data-stock-results]');
  const pagination = container.querySelector('[data-stock-pagination]');
  if (!list) return;

  renderStockSummary(container);
  renderStockFilters(container);

  const products = getFilteredProducts();
  if (results) results.textContent = `${products.length} ${products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  if (!products.length) {
    list.innerHTML = `
      <div class="stock-empty-state">
        <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
        <h3>Nenhum item de estoque encontrado</h3>
        <p>Tente ajustar os filtros ou a busca.</p>
      </div>
    `;
    if (pagination) pagination.innerHTML = '';
    return;
  }

  const perPage = Number(stockState.filters.perPage || 20);
  const totalPages = Math.max(1, Math.ceil(products.length / perPage));
  stockState.page = Math.min(stockState.page, totalPages);
  const start = (stockState.page - 1) * perPage;
  const visibleProducts = products.slice(start, start + perPage);

  list.innerHTML = `<div class="stock-list-shell">${visibleProducts.map(renderStockProductCard).join('')}</div>`;
  if (pagination) {
    pagination.innerHTML = totalPages > 1 ? `
      <span>Página ${stockState.page} de ${totalPages}</span>
      <div>
        <button class="icon-button" type="button" data-stock-page="${stockState.page - 1}" ${stockState.page === 1 ? 'disabled' : ''} aria-label="Página anterior"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
        <button class="icon-button" type="button" data-stock-page="${stockState.page + 1}" ${stockState.page === totalPages ? 'disabled' : ''} aria-label="Próxima página"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>
    ` : '';
  }
}

function renderStockProductCard(product) {
  const totals = calculateProductTotals(product);
  const isExpanded = stockState.expandedProducts.has(product.id);
  const reference = getProductReference(product);
  const firstActiveColor = (product.colors || []).find((color) => color.active !== false && color.variations?.length);
  const visualStatus = getProductStockStatus(product);

  return `
    <article class="stock-product-row ${isExpanded ? 'is-expanded' : ''}">
      <div class="stock-product-row__main">
        <div class="stock-product-row__product">
          <button class="stock-product-row__toggle" type="button" data-toggle-stock-details="${product.id}" aria-expanded="${isExpanded}" aria-label="${isExpanded ? 'Recolher' : 'Expandir'} ${escapeHtml(product.name)}">
            <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <div><strong>${escapeHtml(product.name)}</strong>${reference ? `<small>REF. ${escapeHtml(reference)}</small>` : ''}</div>
        </div>
        <div class="stock-product-row__metric"><span>Estoque total</span><strong>${formatPieces(totals.stockTotal)}</strong></div>
        <div class="stock-product-row__metric"><span>Cores</span><strong>${totals.colorCount}</strong><small>${totals.colorCount === 1 ? 'cor' : 'cores'}</small></div>
        <div class="stock-product-row__metric"><span>Variações</span><strong>${totals.variationCount}</strong><small>combinações</small></div>
        <div class="stock-product-row__metric stock-product-row__last"><span>Última movimentação</span><strong>—</strong></div>
        <div><span class="status-badge ${getStockStatusClass(visualStatus)}">${stockStatusLabels[visualStatus]}</span></div>
        <details class="stock-actions-menu">
          <summary aria-label="Ações do produto" data-tooltip="Ações"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></summary>
          <div>
            ${stockState.isAdmin && firstActiveColor ? `<button type="button" data-open-stock-movement="${product.id}" data-color-id="${firstActiveColor.id}"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>Movimentar estoque</button>` : ''}
            ${stockState.isAdmin && firstActiveColor ? `<button type="button" data-open-stock-history="${product.id}"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>Histórico</button>` : ''}
            ${stockState.isAdmin ? `<a href="#/produtos"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Editar produto</a>` : ''}
            <button type="button" data-toggle-stock-details="${product.id}"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>Visualizar produto</button>
          </div>
        </details>
      </div>
      ${isExpanded ? renderStockProductDetails(product) : ''}
    </article>
  `;
}

function renderStockProductDetails(product) {
  const activeColors = (product.colors || []).filter((color) => color.active !== false);

  if (!activeColors.length) {
    return '<div class="stock-product-row__details"><p class="table-empty">Nenhuma cor cadastrada.</p></div>';
  }

  return `
    <div class="stock-product-row__details">
      ${activeColors.map((color) => renderStockColorBlock(product, color)).join('')}
    </div>
  `;
}

function renderStockColorBlock(product, color) {
  const activeVariations = (color.variations || []).filter((variation) => variation.status !== 'inactive');
  const totals = calculateColorTotals(color);
  const reference = getProductReference(product);
  const sizes = availableSizes.map((size) => {
    const variation = activeVariations.find((item) => item.size === size);
    return `<span><b>${escapeHtml(size)}</b><strong>${Number(variation?.quantity || 0)}</strong></span>`;
  }).join('');

  return `
    <section class="stock-color-row">
      <div class="stock-color-row__identity">
        <img src="${escapeHtml(color.imageUrl || getImagePlaceholder())}" alt="Imagem da cor ${escapeHtml(color.name)}" />
        <div><strong>${escapeHtml(color.name)}</strong>${reference ? `<small>REF. ${escapeHtml(reference)}</small>` : ''}</div>
      </div>
      <div class="stock-color-row__metric"><span>Estoque total</span><strong>${formatPieces(totals.stockTotal)}</strong><small>Última movimentação: —</small></div>
      <div class="stock-color-row__sizes" aria-label="Estoque por tamanho da cor ${escapeHtml(color.name)}">${sizes}</div>
      ${stockState.isAdmin ? `
        <div class="stock-color-row__actions">
          <button class="button button--primary" type="button" data-open-stock-movement="${product.id}" data-color-id="${color.id}">
            <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
            Movimentar
          </button>
          <button class="button button--secondary" type="button" data-open-stock-history="${product.id}" data-color-id="${color.id}"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>Histórico</button>
          <a class="button button--secondary" href="#/produtos"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Editar</a>
        </div>
      ` : ''}
    </section>
  `;
}

function getProductById(productId) {
  return stockState.products.find((product) => product.id === productId);
}

function getColorById(product, colorId) {
  return product?.colors?.find((color) => color.id === colorId);
}

function getVariationById(color, variationId) {
  return color?.variations?.find((variation) => variation.id === variationId);
}

function openMovementModal(container, productId, colorId) {
  if (!stockState.isAdmin) return;

  const product = getProductById(productId);
  const color = getColorById(product, colorId);
  const variations = (color?.variations || []).filter((variation) => variation.status !== 'inactive');
  if (!product || !color || !variations.length) return;
  const sortedVariations = [...variations]
    .sort((a, b) => availableSizes.indexOf(a.size) - availableSizes.indexOf(b.size));
  const selectedVariation = sortedVariations.length === 1 ? sortedVariations[0] : null;

  stockState.movement = {
    product,
    color,
    variation: selectedVariation,
  };

  const modal = container.querySelector('[data-stock-modal]');
  const form = container.querySelector('[data-stock-form]');
  const variationSelect = form.elements.variation_id;
  const sizeOptions = container.querySelector('[data-movement-size-options]');
  const message = container.querySelector('[data-stock-message]');

  form.reset();
  message.textContent = '';
  variationSelect.innerHTML = sortedVariations
    .map((variation) => `<option value="${variation.id}">${escapeHtml(variation.size)}</option>`)
    .join('');
  variationSelect.value = selectedVariation?.id || '';
  sizeOptions.innerHTML = sortedVariations.map((variation) => `
    <button type="button" data-movement-size-option="${variation.id}" aria-pressed="false">
      ${escapeHtml(variation.size)}
    </button>
  `).join('');
  form.elements.reason_option.value = 'Compra';

  modal.hidden = false;
  syncMovementReason(container);
  updateMovementModal(container);
  if (selectedVariation) {
    form.elements.quantity.focus();
  } else {
    sizeOptions.querySelector('button')?.focus();
  }
}

function closeMovementModal(container) {
  const modal = container.querySelector('[data-stock-modal]');
  modal.hidden = true;
  stockState.movement = { product: null, color: null, variation: null };
}

function syncMovementReason(container) {
  const form = container.querySelector('[data-stock-form]');
  const details = container.querySelector('[data-stock-reason-details]');
  const selectedReason = form.elements.reason_option.value;
  const isOther = selectedReason === 'other';

  details.hidden = !isOther;
  if (!isOther) form.elements.reason.value = selectedReason;
  if (isOther) form.elements.reason.value = '';

  container.querySelectorAll('[data-stock-reason-value]').forEach((button) => {
    const isSelected = button.dataset.stockReasonValue === selectedReason;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
}

function syncMovementTypeButtons(container) {
  const form = container.querySelector('[data-stock-form]');
  const movementType = form.elements.movement_type.value;
  form.dataset.movementType = movementType;

  container.querySelectorAll('[data-movement-type-option]').forEach((button) => {
    const isSelected = button.dataset.movementTypeOption === movementType;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
}

function updateMovementPreview(container) {
  const form = container.querySelector('[data-stock-form]');
  const preview = container.querySelector('[data-stock-movement-preview]');
  const feedback = container.querySelector('[data-stock-quantity-feedback]');
  const sizeFeedback = container.querySelector('[data-stock-size-feedback]');
  const submitButton = container.querySelector('[data-stock-submit]');
  const submitIcon = submitButton.querySelector('svg');
  const quantityField = container.querySelector('.stock-quantity-field');
  const movementType = form.elements.movement_type.value;
  const quantity = Number(form.elements.quantity.value || 0);
  const hasVariation = Boolean(stockState.movement.variation);
  const currentQuantity = Number(stockState.movement.variation?.quantity || 0);
  const exceedsStock = hasVariation && movementType === 'exit' && quantity > currentQuantity;
  const isInvalid = !hasVariation || !Number.isInteger(quantity) || quantity <= 0 || exceedsStock;
  const typeLabels = { entry: 'Entrada', exit: 'Saída', adjustment: 'Ajuste' };
  const signedQuantity = movementType === 'entry' ? `+${quantity}` : movementType === 'exit' ? `-${quantity}` : quantity;
  const newQuantity = movementType === 'entry'
    ? currentQuantity + quantity
    : movementType === 'exit'
      ? currentQuantity - quantity
      : quantity;
  const submitIcons = {
    entry: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    exit: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    adjustment: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/>',
  };

  feedback.textContent = exceedsStock
    ? `A saída não pode superar o estoque atual de ${formatPieces(currentQuantity)}.`
    : 'Informe uma quantidade maior que zero.';
  feedback.hidden = quantity > 0 && !exceedsStock;
  sizeFeedback.hidden = hasVariation;
  quantityField.classList.toggle('is-invalid', isInvalid);
  submitButton.disabled = isInvalid;
  submitButton.classList.remove('stock-confirm--entry', 'stock-confirm--exit', 'stock-confirm--adjustment');
  submitButton.classList.add(`stock-confirm--${movementType}`);
  submitIcon.innerHTML = submitIcons[movementType];

  preview.className = `stock-movement-preview stock-movement-preview--${movementType}`;
  preview.innerHTML = `
    <h4>Resumo da movimentação</h4>
    <dl>
      <div><dt>Tipo</dt><dd>${typeLabels[movementType]}</dd></div>
      <div><dt>${movementType === 'adjustment' ? 'Novo estoque' : 'Quantidade'}</dt><dd>${movementType === 'adjustment' ? formatPieces(quantity) : `${signedQuantity} ${quantity === 1 ? 'peça' : 'peças'}`}</dd></div>
      <div><dt>Estoque atual</dt><dd>${hasVariation ? formatPieces(currentQuantity) : '—'}</dd></div>
      ${movementType === 'adjustment' ? '' : `<div><dt>Novo estoque</dt><dd>${!hasVariation ? 'Selecione um tamanho' : exceedsStock ? 'Movimentação inválida' : formatPieces(newQuantity)}</dd></div>`}
    </dl>
  `;
}

function updateMovementModal(container) {
  const form = container.querySelector('[data-stock-form]');
  const summary = container.querySelector('[data-movement-summary]');
  const quantityLabel = container.querySelector('[data-quantity-label]');
  const { product, color } = stockState.movement;
  const variation = getVariationById(color, form.elements.variation_id.value);
  const movementType = form.elements.movement_type.value;

  stockState.movement.variation = variation;
  form.elements.current_quantity.value = variation?.quantity ?? 0;
  quantityLabel.textContent = movementType === 'adjustment' ? 'Novo estoque final' : 'Quantidade';
  syncMovementTypeButtons(container);

  container.querySelectorAll('[data-movement-size-option]').forEach((button) => {
    const isSelected = button.dataset.movementSizeOption === variation?.id;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });

  const reference = getProductReference(product);

  summary.innerHTML = `
    <div class="movement-info-grid">
      <article class="movement-info-card"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12l3 7-9 13L3 9Z"/><path d="M3 9h18"/></svg><div><span>Produto</span><strong>${escapeHtml(product?.name || '')}${reference ? `<small>REF. ${escapeHtml(reference)}</small>` : ''}</strong></div></article>
      <article class="movement-info-card"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg><div><span>Cor</span><strong><i aria-hidden="true"></i>${escapeHtml(color?.name || '')}</strong></div></article>
      <article class="movement-info-card"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/></svg><div><span>Tamanho</span><strong>${escapeHtml(variation?.size || 'Selecione')}</strong></div></article>
      <article class="movement-info-card"><svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg><div><span>Estoque atual</span><strong>${variation ? formatPieces(variation.quantity) : '—'}</strong></div></article>
    </div>
  `;
  updateMovementPreview(container);
}

async function submitMovement(container, event) {
  event.preventDefault();
  if (!stockState.isAdmin) return;

  const form = event.currentTarget;
  const message = container.querySelector('[data-stock-message]');
  const variation = stockState.movement.variation;
  const movementType = form.elements.movement_type.value;
  const quantity = Number(form.elements.quantity.value || 0);
  const reason = form.elements.reason.value.trim();
  const currentQuantity = Number(variation?.quantity || 0);

  if (!variation) {
    message.textContent = 'Selecione uma variação para movimentar.';
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    message.textContent = movementType === 'adjustment'
      ? 'Informe o novo estoque final.'
      : 'Informe uma quantidade maior que zero.';
    return;
  }

  if (!reason) {
    message.textContent = 'Informe o motivo da movimentação.';
    return;
  }

  if (movementType === 'exit' && quantity > currentQuantity) {
    message.textContent = 'Saída não permitida: o estoque não pode ficar negativo.';
    return;
  }

  message.textContent = 'Confirmando movimentação...';

  const { error } = await supabase.rpc('admin_adjust_stock', {
    p_variation_id: variation.id,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_reason: reason,
  });

  if (error) {
    console.error('Erro ao movimentar estoque:', error);
    message.textContent = `Erro ao movimentar estoque: ${error.message}`;
    return;
  }

  closeMovementModal(container);
  await loadStock(container);
}

function bindStockEvents(container) {
  const filtersForm = container.querySelector('[data-stock-filters]');
  const signal = stockState.abortController.signal;

  filtersForm.addEventListener('input', () => {
    stockState.filters.search = filtersForm.elements.search.value;
    stockState.page = 1;
    renderStockList(container);
  }, { signal });

  container.querySelector('[data-stock-form]')?.addEventListener('submit', (event) => {
    submitMovement(container, event);
  }, { signal });

  container.querySelectorAll('[data-close-stock-modal]').forEach((button) => {
    button.addEventListener('click', () => closeMovementModal(container), { signal });
  });

  container.querySelectorAll('[data-close-stock-history]').forEach((button) => {
    button.addEventListener('click', () => closeStockHistoryModal(container), { signal });
  });

  container.addEventListener('input', (event) => {
    if (event.target.matches('[name="quantity"]')) updateMovementPreview(container);
  }, { signal });

  container.addEventListener('change', (event) => {
    if (event.target.matches('[data-movement-variation], [data-movement-type]')) {
      updateMovementModal(container);
      return;
    }

    if (event.target.matches('[data-stock-reason-option]')) syncMovementReason(container);
  }, { signal });

  container.addEventListener('click', (event) => {
    const detailsButton = event.target.closest('[data-toggle-stock-details]');
    const movementButton = event.target.closest('[data-open-stock-movement]');
    const historyButton = event.target.closest('[data-open-stock-history]');
    const filterTrigger = event.target.closest('[data-stock-filter-trigger]');
    const filterOption = event.target.closest('[data-stock-filter-option]');
    const movementTypeButton = event.target.closest('[data-movement-type-option]');
    const movementSizeButton = event.target.closest('[data-movement-size-option]');
    const quantityStepButton = event.target.closest('[data-stock-quantity-step]');
    const reasonButton = event.target.closest('[data-stock-reason-value]');
    const historyFilterButton = event.target.closest('[data-stock-history-filter]');
    const pageButton = event.target.closest('[data-stock-page]');

    if (pageButton && !pageButton.disabled) {
      stockState.page = Number(pageButton.dataset.stockPage);
      renderStockList(container);
      container.querySelector('[data-stock-list]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (historyFilterButton) {
      stockState.history.filter = historyFilterButton.dataset.stockHistoryFilter;
      renderStockHistoryModal(container);
      return;
    }

    if (filterTrigger) {
      const name = filterTrigger.dataset.stockFilterTrigger;
      const field = filterTrigger.closest('[data-stock-filter-field]');
      closeStockFilterMenus(container, field?.classList.contains('is-open') ? '' : name);
      return;
    }

    if (filterOption) {
      const name = filterOption.dataset.stockFilterOption;
      stockState.filters[name] = filterOption.dataset.value;
      stockState.page = 1;
      closeStockFilterMenus(container);
      renderStockList(container);
      return;
    }

    if (!event.target.closest('[data-stock-filter-field]')) closeStockFilterMenus(container);

    if (movementSizeButton) {
      const form = container.querySelector('[data-stock-form]');
      form.elements.variation_id.value = movementSizeButton.dataset.movementSizeOption;
      updateMovementModal(container);
      form.elements.quantity.focus();
      return;
    }

    if (movementTypeButton) {
      const form = container.querySelector('[data-stock-form]');
      form.elements.movement_type.value = movementTypeButton.dataset.movementTypeOption;
      updateMovementModal(container);
      return;
    }

    if (reasonButton) {
      const form = container.querySelector('[data-stock-form]');
      form.elements.reason_option.value = reasonButton.dataset.stockReasonValue;
      syncMovementReason(container);
      if (reasonButton.dataset.stockReasonValue === 'other') form.elements.reason.focus();
      return;
    }

    if (quantityStepButton) {
      const form = container.querySelector('[data-stock-form]');
      const quantity = Math.max(0, Number(form.elements.quantity.value || 0) + Number(quantityStepButton.dataset.stockQuantityStep));
      form.elements.quantity.value = quantity;
      form.elements.quantity.focus();
      updateMovementPreview(container);
      return;
    }

    if (detailsButton) {
      const productId = detailsButton.dataset.toggleStockDetails;
      if (stockState.expandedProducts.has(productId)) {
        stockState.expandedProducts.delete(productId);
      } else {
        stockState.expandedProducts.add(productId);
      }
      renderStockList(container);
      return;
    }

    if (movementButton) {
      openMovementModal(container, movementButton.dataset.openStockMovement, movementButton.dataset.colorId);
      return;
    }

    if (historyButton) {
      openStockHistoryModal(
        container,
        historyButton.dataset.openStockHistory,
        historyButton.dataset.colorId || '',
        historyButton.dataset.variationId || '',
      );
    }
  }, { signal });
}

export function renderStock(container, route, { profile }) {
  stockState.abortController?.abort();
  stockState.abortController = new AbortController();
  stockState.profile = profile;
  stockState.isAdmin = isAdmin(profile);
  stockState.filters = { search: '', status: 'all', sort: 'name-asc', perPage: '20' };
  stockState.page = 1;
  stockState.expandedProducts = new Set();
  stockState.movement = { product: null, color: null, variation: null };
  stockState.history = { movements: [], filter: 'all', scope: null };

  renderStockLayout(container, route);
  bindStockEvents(container);
  loadStock(container);
}
