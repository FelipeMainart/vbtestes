import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';

const availableSizes = ['PP', 'P', 'M', 'G', 'GG'];
const colorImageBucket = 'product-images';
const allowedColorImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

const productState = {
  products: [],
  profile: null,
  isAdmin: false,
  expandedProducts: new Set(),
  salesMetrics: new Map(),
  filters: {
    search: '',
    category: 'all',
    color: 'all',
    stock: 'all',
    status: 'all',
  },
  editingProduct: null,
  variationDraft: createEmptyVariationDraft(),
  abortController: null,
};

const statusLabels = {
  active: 'Ativo',
  inactive: 'Inativo',
};

function createEmptyVariationDraft() {
  return {
    colors: [],
    sizes: [],
    cells: {},
    existingKeys: new Set(),
    lockedColorKeys: new Set(),
    lockedSizes: new Set(),
    defaultMinimumStock: 3,
  };
}

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMoney(value) {
  const rawValue = String(value || '0').trim();
  const normalized = rawValue.includes(',')
    ? rawValue.replace(/\./g, '').replace(',', '.')
    : rawValue;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getStatusLabel(value) {
  return statusLabels[value] || value || 'Ativo';
}

function isValidColorImage(file) {
  if (!file) return false;
  const validExtension = /\.(jpe?g|png|webp)$/i.test(file.name);
  return allowedColorImageTypes.includes(file.type) || validExtension;
}

function formatSupabaseError(error) {
  return {
    object: error,
    message: error?.message || 'Erro desconhecido',
    details: error?.details || null,
    hint: error?.hint || null,
    code: error?.code || null,
    statusCode: error?.statusCode || error?.status || null,
  };
}

function logSupabaseError(step, error, context = {}) {
  const formattedError = formatSupabaseError(error);
  console.group(`Erro Supabase em: ${step}`);
  console.error('Objeto completo:', formattedError.object);
  console.error('message:', formattedError.message);
  console.error('details:', formattedError.details);
  console.error('hint:', formattedError.hint);
  console.error('code:', formattedError.code);
  console.error('statusCode:', formattedError.statusCode);
  console.error('contexto:', context);
  console.groupEnd();
}

function throwSupabaseStepError(step, error, context = {}) {
  logSupabaseError(step, error, context);
  error.step = step;
  error.context = context;
  throw error;
}

function buildStorageUploadError(error, colorName) {
  const message = error?.message || 'erro desconhecido no Storage';
  const storageError = new Error(
    `Falha no upload da imagem da cor "${colorName}" no bucket product-images: ${message}. Verifique se o bucket existe e se as policies permitem upload/update.`
  );

  storageError.originalError = error;
  storageError.details = error?.details || null;
  storageError.hint = error?.hint || null;
  storageError.code = error?.code || error?.statusCode || error?.status || null;
  storageError.statusCode = error?.statusCode || error?.status || null;

  return storageError;
}

function colorKey(color) {
  return color.id || color.tempId;
}

function variationKey(color, size) {
  return `${colorKey(color)}|${size}`;
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function createColorDraft({ id = null, name, imageUrl = null, active = true, existing = false, file = null }) {
  return {
    id,
    tempId: id || `tmp-${crypto.randomUUID()}`,
    name,
    imageUrl: imageUrl || null,
    active,
    existing,
    file: file || null,
    fileName: file?.name || '',
  };
}

function buildMissingColorImageError(colorName) {
  const error = new Error(`Selecione uma imagem para a cor ${colorName}.`);
  error.step = 'validate product_colors image';
  error.context = { colorName };
  error.userMessageOnly = true;
  return error;
}

function getImagePlaceholder() {
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" rx="8" fill="%23e2e8f0"/><text x="30" y="35" text-anchor="middle" font-size="10" fill="%2364748b">sem foto</text></svg>';
}

function calculateProductTotals(product) {
  const colors = product.colors || [];
  const variations = colors.flatMap((color) => color.variations || []);
  const activeColors = colors.filter((color) => color.active !== false);
  const activeVariations = variations.filter((variation) => variation.status !== 'inactive');

  return {
    colorCount: activeColors.length,
    variationCount: activeVariations.length,
    stockTotal: activeVariations.reduce((total, variation) => total + Number(variation.quantity || 0), 0),
  };
}

function getProductReference(product) {
  return product?.sku?.trim() || '';
}

function getProductDisplayReference(product) {
  return getProductReference(product).replace(/^(?:ref\.?\s*:?\s*)+/i, '').trim();
}

function getProductSizes(product) {
  const sizes = new Set();
  (product.colors || []).forEach((color) => {
    (color.variations || [])
      .filter((variation) => variation.status !== 'inactive')
      .forEach((variation) => sizes.add(variation.size));
  });
  return availableSizes.filter((size) => sizes.has(size));
}

function hasLowStock(product) {
  return (product.colors || []).some((color) => (
    color.active !== false
    && (color.variations || []).some((variation) => {
      const quantity = Number(variation.quantity || 0);
      const minimum = Number(variation.minimum_stock || 0);
      return variation.status !== 'inactive' && quantity > 0 && quantity <= minimum;
    })
  ));
}

function getProductVisualStatus(product) {
  const totals = calculateProductTotals(product);
  if (product.status === 'inactive') return { label: 'Inativo', className: 'status-badge--inactive' };
  if (totals.stockTotal <= 0) return { label: 'Sem estoque', className: 'status-badge--out-of-stock' };
  if (hasLowStock(product)) return { label: 'Estoque baixo', className: 'status-badge--warning' };
  return { label: 'Ativo', className: 'status-badge--active' };
}

function getColorVisualStatus(color) {
  const activeVariations = (color.variations || []).filter((variation) => variation.status !== 'inactive');
  const stockTotal = activeVariations.reduce((total, variation) => total + Number(variation.quantity || 0), 0);
  const lowStock = activeVariations.some((variation) => {
    const quantity = Number(variation.quantity || 0);
    const minimum = Number(variation.minimum_stock || 0);
    return quantity > 0 && quantity <= minimum;
  });

  if (color.active === false) return { label: 'Inativa', className: 'status-badge--inactive' };
  if (stockTotal <= 0) return { label: 'Sem estoque', className: 'status-badge--inactive' };
  if (lowStock) return { label: 'Estoque baixo', className: 'status-badge--warning' };
  return { label: 'Ativa', className: 'status-badge--active' };
}

function getProductMetrics(product) {
  return productState.salesMetrics.get(product.id) || { quantity: 0, revenue: 0 };
}

function getColorOptions() {
  return [...new Set(productState.products.flatMap((product) => (
    (product.colors || []).map((color) => color.name).filter(Boolean)
  )))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getProductStats() {
  return productState.products.reduce((stats, product) => {
    const totals = calculateProductTotals(product);
    stats.all += 1;
    if (product.status === 'inactive') stats.inactive += 1;
    if (product.status !== 'inactive') stats.active += 1;
    if (totals.stockTotal <= 0) stats.outOfStock += 1;
    return stats;
  }, { all: 0, active: 0, inactive: 0, outOfStock: 0 });
}

function getFilteredProducts() {
  const search = productState.filters.search.trim().toLowerCase();
  const selectedColor = productState.filters.color;

  return productState.products.filter((product) => {
    const reference = getProductReference(product).toLowerCase();
    const matchesColorSearch = (product.colors || []).some((color) => (
      String(color.name || '').toLowerCase().includes(search)
    ));
    const matchesSearch = !search
      || product.name.toLowerCase().includes(search)
      || reference.includes(search)
      || matchesColorSearch;
    const matchesStatus = productState.filters.status === 'all' || product.status === productState.filters.status;
    const matchesColor = selectedColor === 'all'
      || (product.colors || []).some((color) => color.name === selectedColor);
    const matchesStock = productState.filters.stock !== 'out' || calculateProductTotals(product).stockTotal <= 0;
    return matchesSearch && matchesStatus && matchesColor && matchesStock;
  });
}

async function loadProductSalesMetrics() {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const { data: sales, error: salesError } = await supabase
    .from('vw_sales_seller')
    .select('id, status, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (salesError) {
    console.warn('Métricas de vendas indisponíveis para produtos:', salesError.message);
    return new Map();
  }

  const saleIds = (sales || [])
    .filter((sale) => sale.status !== 'cancelled')
    .map((sale) => sale.id);

  if (!saleIds.length) return new Map();

  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select('sale_id, product_id, quantity, subtotal')
    .in('sale_id', saleIds);

  if (itemsError) {
    console.warn('Itens de venda indisponíveis para métricas de produtos:', itemsError.message);
    return new Map();
  }

  return (items || []).reduce((metrics, item) => {
    if (!item.product_id) return metrics;
    const current = metrics.get(item.product_id) || { quantity: 0, revenue: 0 };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.subtotal || 0);
    metrics.set(item.product_id, current);
    return metrics;
  }, new Map());
}

async function loadAdminProducts() {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, description, sku, sale_price, cost_price, status, created_at')
    .order('name', { ascending: true });

  if (productsError) throw productsError;

  const productIds = (products || []).map((product) => product.id);
  let colors = [];
  let variations = [];

  if (productIds.length) {
    const { data: colorsData, error: colorsError } = await supabase
      .from('product_colors')
      .select('id, product_id, color_name, image_url, active, created_at')
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

  return composeProducts(products || [], colors, variations);
}

async function loadSellerProducts() {
  const { data: products, error: productsError } = await supabase
    .from('vw_products_seller')
    .select('id, name, description, sku, sale_price, status, created_at, colors_count, variations_count, stock_total, color_images')
    .order('name', { ascending: true });

  if (productsError) throw productsError;

  const { data: stockRows, error: stockError } = await supabase
    .from('vw_stock_seller')
    .select('variation_id, product_id, product_color_id, color_name, color_image_url, color_active, size, quantity, minimum_stock, variation_status');

  if (stockError) throw stockError;

  return composeSellerProducts(products || [], stockRows || []);
}

function composeProducts(products, colors, variations) {
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

function composeSellerProducts(products, stockRows) {
  const productsById = new Map();

  products.forEach((product) => {
    const productColors = Array.isArray(product.color_images) ? product.color_images : [];
    productsById.set(product.id, {
      ...product,
      colors: productColors.map((color) => ({
        id: color.product_color_id,
        product_id: product.id,
        name: color.color_name,
        imageUrl: color.image_url,
        active: color.active,
        variations: [],
      })),
    });
  });

  stockRows.forEach((row) => {
    const product = productsById.get(row.product_id);
    if (!product) return;

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

async function loadProducts(container) {
  setTableLoading(container);

  try {
    const [products, salesMetrics] = await Promise.all([
      productState.isAdmin ? loadAdminProducts() : loadSellerProducts(),
      loadProductSalesMetrics(),
    ]);

    productState.products = products;
    productState.salesMetrics = salesMetrics;

    renderTable(container);
  } catch (error) {
    console.error('Erro ao carregar produtos:', error.message);
    setTableError(container, 'Não foi possível carregar os produtos.');
  }
}

function renderProductsLayout(container) {
  container.innerHTML = `
    <section class="module-panel products-module" aria-labelledby="products-title" data-products-list-view>
      <div class="module-header">
        <div>
          <h2 id="products-title">Produtos</h2>
          <p class="module-panel__text" data-products-total>Carregando produtos...</p>
        </div>
        ${productState.isAdmin ? `
          <div class="module-header__actions">
            <button class="button button--secondary" type="button" data-import-products>
              <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>
              Importar produtos
            </button>
            <button class="button button--primary" type="button" data-new-product>
              <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              Novo produto
            </button>
          </div>
        ` : ''}
      </div>

      <form class="products-toolbar" data-products-filters>
        <label class="products-search-field">
          <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" name="search" placeholder="Buscar produto, referência ou cor..." autocomplete="off" />
        </label>
        <label class="products-filter-field" data-product-filter-field="category">
          <span>Categoria</span>
          <input type="hidden" name="category" value="all" />
          <button class="products-filter-control" type="button" data-product-filter-trigger="category">
            <b data-product-filter-label="category">Todas</b>
            <i aria-hidden="true"></i>
          </button>
          <div class="products-filter-menu" data-product-filter-menu="category"></div>
        </label>
        <label class="products-filter-field" data-product-filter-field="color">
          <span>Cor</span>
          <input type="hidden" name="color" value="all" data-product-color-filter />
          <button class="products-filter-control" type="button" data-product-filter-trigger="color">
            <b data-product-filter-label="color">Todas</b>
            <i aria-hidden="true"></i>
          </button>
          <div class="products-filter-menu" data-product-filter-menu="color"></div>
        </label>
        <label class="products-filter-field" data-product-filter-field="status">
          <span>Status</span>
          <input type="hidden" name="status" value="all" />
          <button class="products-filter-control" type="button" data-product-filter-trigger="status">
            <b data-product-filter-label="status">Todos</b>
            <i aria-hidden="true"></i>
          </button>
          <div class="products-filter-menu" data-product-filter-menu="status"></div>
        </label>
      </form>

      <div class="products-counts" data-products-counts></div>

      <div class="products-table" data-products-table>
        <p class="table-empty">Carregando produtos...</p>
      </div>
    </section>

    <section class="products-editor" data-product-form-page hidden>
      <form class="products-editor__form" data-product-form>
        <header class="products-editor__header">
          <button class="button button--secondary products-editor__back-button" type="button" data-close-product-modal>&larr; Voltar para Produtos</button>
          <button class="button button--secondary" type="button" data-close-product-modal>← Voltar para Produtos</button>
            <div>
              <p class="eyebrow">Cadastro</p>
              <h2 id="product-modal-title">Novo Produto</h2>
            </div>
        </header>
            <button class="icon-button" type="button" data-close-product-modal aria-label="Fechar">×</button>
          <span hidden></span>

          <div class="form-grid">
            <label class="form-field product-field-name">
              <span>Nome</span>
              <input name="name" type="text" maxlength="160" required />
            </label>
            <label class="form-field product-field-price">
              <span>Preço de venda</span>
              <input name="sale_price" type="number" min="0" step="0.01" required />
            </label>
            ${productState.isAdmin ? `
              <label class="form-field product-field-cost">
                <span>Custo</span>
                <input name="cost_price" type="number" min="0" step="0.01" required />
              </label>
            ` : ''}
            <label class="form-field product-field-status">
              <span>Status</span>
              <input class="product-status-native" name="status" type="hidden" value="active" data-product-status-native />
              <button class="product-status-switch" type="button" data-product-status-switch aria-pressed="true">
                <span data-status-inactive>Inativo</span>
                <i aria-hidden="true"><b></b></i>
                <span data-status-active>Ativo</span>
              </button>
            </label>
            <label class="form-field product-field-sku">
              <span>Refer&ecirc;ncia (REF.)</span>
              <input name="sku" type="text" maxlength="80" placeholder="Ex.: COLE-001" data-product-sku />
            </label>
            <label class="form-field form-field--full product-field-description">
              <span>Descrição</span>
              <textarea name="description" rows="4"></textarea>
            </label>
          </div>

          <section class="variation-builder" aria-labelledby="variation-builder-title">
            <div class="variation-builder__header">
              <div>
                <h4 id="variation-builder-title">Cores e tamanhos</h4>
                <p>A imagem pertence à cor e será reutilizada por todos os tamanhos dessa cor.</p>
              </div>
            </div>

            <div class="variation-builder__grid">
              <div class="variation-box">
                <div class="form-field">
                  <span>Nome da Cor</span>
                  <div class="inline-field">
                    <input name="color_name" type="text" placeholder="Ex.: Preto" />
                    <button class="button button--secondary" type="button" data-add-color>Adicionar Cor</button>
                  </div>
                </div>
                <label class="color-upload-field">
                  <input name="color_image" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" />
                  <img data-color-upload-preview alt="Preview da imagem da cor" hidden />
                  <span class="color-upload-field__icon" aria-hidden="true"></span>
                  <strong data-color-upload-title>Clique ou arraste a imagem da cor</strong>
                  <small data-color-file-status>PNG, JPG ou WEBP ate 5MB</small>
                </label>
                <button class="button button--secondary color-upload-clear" type="button" data-clear-color-image hidden>Remover imagem</button>
                <div class="chip-list color-card-list" data-color-list></div>
              </div>

              <div class="variation-box">
                <span class="field-label">Tamanhos</span>
                <div class="checkbox-grid" data-size-options>
                  ${availableSizes.map((size) => `
                    <label>
                      <input type="checkbox" value="${size}" />
                      <span>${size}</span>
                    </label>
                  `).join('')}
                </div>
                <div class="variation-table-area" data-variation-table></div>
              </div>
            </div>

            <label class="form-field variation-minimum-field">
              <span>Estoque mínimo padrão</span>
              <input name="default_minimum_stock" type="number" min="0" step="1" value="3" data-default-minimum-stock />
            </label>

            <div class="variation-table-area" data-variation-table></div>
            <div class="variation-summary" data-variation-summary></div>
          </section>

          <p class="form-message" data-product-message></p>

          <footer class="products-editor-footer">
            <button class="button button--secondary" type="button" data-close-product-modal>Cancelar</button>
            <button class="button button--primary" type="submit">Salvar Produto</button>
          </footer>
        </form>
    </section>
  `;
}

function setTableLoading(container) {
  const tableBody = container.querySelector('[data-products-table]');
  if (!tableBody) return;
  tableBody.innerHTML = '<p class="table-empty">Carregando produtos...</p>';
}

function setTableError(container, message) {
  const tableBody = container.querySelector('[data-products-table]');
  if (!tableBody) return;
  tableBody.innerHTML = `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function renderTable(container) {
  const tableBody = container.querySelector('[data-products-table]');
  if (!tableBody) return;
  renderProductFilters(container);
  renderProductCounts(container);
  const products = getFilteredProducts();

  if (!products.length) {
    tableBody.innerHTML = `
      <div class="products-empty-state">
        <div class="products-empty-state__illustration" aria-hidden="true">
          <svg class="lucide" viewBox="0 0 24 24"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
        </div>
        <div>
          <h3>Nenhum produto encontrado</h3>
          <p>${productState.products.length ? 'Tente ajustar os filtros ou a busca.' : 'Cadastre o primeiro produto para começar a organizar seu catálogo.'}</p>
        </div>
        ${productState.isAdmin && !productState.products.length ? `
          <button class="button button--primary" type="button" data-empty-new-product>
            <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Cadastrar produto
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  tableBody.innerHTML = `
    <div class="products-table__head" aria-hidden="true">
      <span>Produto</span>
      <span>Cores</span>
      <span>Tamanhos</span>
      <span>Estoque total</span>
      <span>Vendas 30 dias</span>
      <span>Faturamento 30 dias</span>
      <span>Preço</span>
      <span>Status</span>
      <span>Ações</span>
    </div>
    <div class="products-table__body">
      ${products.map(renderProductCard).join('')}
    </div>
  `;
}

function renderProductFilters(container) {
  const colorOptions = getColorOptions();
  const currentColor = productState.filters.color;
  productState.filters.color = colorOptions.includes(currentColor) ? currentColor : 'all';

  renderProductFilterMenu(container, 'category', [{ value: 'all', label: 'Todas' }], productState.filters.category);
  renderProductFilterMenu(container, 'color', [
    { value: 'all', label: 'Todas' },
    ...colorOptions.map((color) => ({ value: color, label: color })),
  ], productState.filters.color);
  renderProductFilterMenu(container, 'status', [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
  ], productState.filters.status);
}

function renderProductFilterMenu(container, name, options, currentValue) {
  const input = container.querySelector(`[name="${name}"]`);
  const label = container.querySelector(`[data-product-filter-label="${name}"]`);
  const menu = container.querySelector(`[data-product-filter-menu="${name}"]`);
  const selected = options.find((option) => option.value === currentValue) || options[0];

  if (input) input.value = selected.value;
  if (label) label.textContent = selected.label;
  if (!menu) return;

  menu.innerHTML = options.map((option) => `
    <button class="${option.value === selected.value ? 'is-selected' : ''}" type="button" data-product-filter-option="${name}" data-value="${escapeHtml(option.value)}">
      ${escapeHtml(option.label)}
    </button>
  `).join('');
}

function closeProductFilterMenus(container, exceptName = '') {
  container.querySelectorAll('[data-product-filter-field]').forEach((field) => {
    field.classList.toggle('is-open', field.dataset.productFilterField === exceptName);
  });
}

function renderProductCounts(container) {
  const counts = container.querySelector('[data-products-counts]');
  if (!counts) return;

  const stats = getProductStats();
  const totalLabel = container.querySelector('[data-products-total]');
  if (totalLabel) {
    totalLabel.textContent = `${stats.all} ${stats.all === 1 ? 'produto cadastrado' : 'produtos cadastrados'}`;
  }
  counts.innerHTML = `
    <button class="product-count-card ${productState.filters.status === 'all' && productState.filters.stock === 'all' ? 'is-active' : ''}" type="button" data-product-status-filter="all">
      <span>Todos</span>
      <strong>${stats.all}</strong>
    </button>
    <button class="product-count-card product-count-card--success ${productState.filters.status === 'active' && productState.filters.stock === 'all' ? 'is-active' : ''}" type="button" data-product-status-filter="active">
      <span>Ativos</span>
      <strong>${stats.active}</strong>
    </button>
    <button class="product-count-card ${productState.filters.status === 'inactive' && productState.filters.stock === 'all' ? 'is-active' : ''}" type="button" data-product-status-filter="inactive">
      <span>Inativos</span>
      <strong>${stats.inactive}</strong>
    </button>
    <button class="product-count-card product-count-card--danger ${productState.filters.stock === 'out' ? 'is-active' : ''}" type="button" data-product-stock-filter="out">
      <span>Sem estoque</span>
      <strong>${stats.outOfStock}</strong>
    </button>
  `;
}

function renderProductCard(product) {
  const totals = calculateProductTotals(product);
  const isExpanded = productState.expandedProducts.has(product.id);
  const metrics = getProductMetrics(product);
  const visualStatus = getProductVisualStatus(product);
  const reference = getProductDisplayReference(product);
  const colors = product.colors || [];
  const colorPreview = colors.slice(0, 4).map((color) => `
    <img src="${escapeHtml(color.imageUrl || getImagePlaceholder())}" alt="${escapeHtml(color.name || 'Cor')}" title="${escapeHtml(color.name || 'Cor')}" />
  `).join('');
  const sizes = getProductSizes(product);

  return `
    <article class="product-card products-row ${isExpanded ? 'is-expanded' : ''}">
      <div class="product-card__main products-row__main">
        <div class="products-row__product">
          <button class="product-card__toggle" type="button" data-toggle-product-details="${product.id}" aria-expanded="${isExpanded}" aria-label="${isExpanded ? 'Recolher' : 'Expandir'} ${escapeHtml(product.name)}">
            <span aria-hidden="true">${isExpanded ? '&uarr;' : '&rsaquo;'}</span>
          </button>
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            ${reference ? `<small>REF. ${escapeHtml(reference)}</small>` : ''}
          </div>
        </div>
        <div class="products-row__colors">
          <div class="products-color-stack">${colorPreview || '<span class="products-thumb-placeholder">Sem foto</span>'}</div>
          <small>${totals.colorCount} ${totals.colorCount === 1 ? 'cor' : 'cores'}</small>
        </div>
        <div class="products-row__sizes">${sizes.length ? sizes.join(', ') : '-'}</div>
        <div class="products-row__metric products-row__metric--stock"><strong>${totals.stockTotal}</strong><small>unidades</small></div>
        <div class="products-row__metric products-row__metric--sales"><strong>${metrics.quantity}</strong><small>unidades</small></div>
        <div class="products-row__money products-row__money--revenue">${currency(metrics.revenue)}</div>
        <div class="products-row__money products-row__money--price">${currency(product.sale_price)}</div>
        <div><span class="status-badge ${visualStatus.className}">${visualStatus.label}</span></div>
        <div class="product-card__actions">
          ${renderProductActions(product)}
        </div>
      </div>
      ${isExpanded ? renderProductDetails(product) : ''}
    </article>
  `;
}

function renderProductDetails(product) {
  if (!product.colors.length) {
    return '<div class="product-card__details products-expanded"><p class="table-empty">Nenhuma cor cadastrada.</p></div>';
  }

  return `
    <div class="product-card__details products-expanded">
      <h3>Cores e estoque por tamanho</h3>
      ${product.colors.map(renderColorStockBlock).join('')}
    </div>
  `;
}

function renderColorStockBlock(color) {
  const activeVariations = (color.variations || []).filter((variation) => variation.status !== 'inactive');
  const stockTotal = activeVariations.reduce((total, variation) => total + Number(variation.quantity || 0), 0);
  const reference = getProductDisplayReference(getProductById(color.product_id));
  const sizeHeaders = availableSizes.map((size) => `<span>${escapeHtml(size)}</span>`).join('');
  const stockCells = availableSizes
    .map((size) => {
      const variation = activeVariations.find((item) => item.size === size);
      const quantity = Number(variation?.quantity || 0);
      return `<span>${quantity}</span>`;
    })
    .join('');

  return `
    <section class="color-stock products-color-card">
      <img src="${escapeHtml(color.imageUrl || getImagePlaceholder())}" alt="Imagem da cor ${escapeHtml(color.name)}" />
      <div class="products-color-card__body">
        <div class="products-color-card__header">
          <div class="products-color-card__identity">
            <span class="products-color-dot" aria-hidden="true"></span>
            <div>
              <strong>${escapeHtml(color.name)}</strong>
              ${reference ? `<small>REF. ${escapeHtml(reference)}</small>` : ''}
            </div>
          </div>
          <strong class="products-color-card__total"><span>Total</span>${stockTotal} un.</strong>
        </div>
        <div class="products-size-grid" aria-label="Estoque por tamanho da cor ${escapeHtml(color.name)}">
          <strong>Tamanho</strong>
          ${sizeHeaders}
          <strong>Qtd.</strong>
          ${stockCells}
        </div>
      </div>
    </section>
  `;
}

function renderProductActions(product) {
  const viewAction = `
    <button type="button" data-toggle-product-details="${product.id}">
      <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
      Visualizar
    </button>
  `;
  if (!productState.isAdmin) {
    return `
      <details class="products-actions-menu">
        <summary aria-label="Ações do produto" data-tooltip="Ações">
          <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </summary>
        <div>${viewAction}</div>
      </details>
    `;
  }

  const nextStatus = product.status === 'active' ? 'inactive' : 'active';
  const statusAction = product.status === 'active' ? 'Inativar' : 'Ativar';

  return `
    <details class="products-actions-menu">
      <summary aria-label="Ações do produto" data-tooltip="Ações">
        <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </summary>
      <div>
        ${viewAction}
        <button type="button" data-edit-product="${product.id}">
          <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          Editar
        </button>
        <button type="button" data-duplicate-product="${product.id}">
          <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Duplicar
        </button>
        <a href="#/estoque">
          <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          Gerenciar estoque
        </a>
        <button type="button" data-toggle-product="${product.id}" data-next-status="${nextStatus}">
          <svg class="lucide" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
          ${statusAction}
        </button>
      </div>
    </details>
  `;
}

function getProductById(productId) {
  return productState.products.find((product) => product.id === productId);
}

function openProductModal(container, product = null) {
  if (!productState.isAdmin) return;

  productState.editingProduct = product;
  productState.variationDraft = product ? buildDraftFromProduct(product) : createEmptyVariationDraft();

  const formPage = container.querySelector('[data-product-form-page]');
  const listView = container.querySelector('[data-products-list-view]');
  const title = container.querySelector('#product-modal-title');
  const eyebrow = container.querySelector('.products-editor__header .eyebrow');
  const form = container.querySelector('[data-product-form]');
  const message = container.querySelector('[data-product-message]');

  title.textContent = product ? 'Editar Produto' : 'Novo Produto';
  if (eyebrow) eyebrow.textContent = product ? 'Edição' : 'Cadastro';
  if (eyebrow) {
    eyebrow.textContent = 'Produtos';
    eyebrow.dataset.productEditorCurrent = product ? 'Editar Produto' : 'Novo Produto';
  }
  message.textContent = '';
  form.reset();
  form.elements.name.value = product?.name || '';
  form.elements.description.value = product?.description || '';
  form.elements.sale_price.value = product?.sale_price ?? '';
  form.elements.status.value = product?.status || 'active';
  if (form.elements.sku) {
    form.elements.sku.value = product?.sku || '';
  }

  if (form.elements.cost_price) {
    form.elements.cost_price.value = product?.cost_price ?? '';
  }

  form.elements.default_minimum_stock.value = '3';

  if (listView) listView.hidden = true;
  if (formPage) formPage.hidden = false;
  renderVariationBuilder(container);
  formPage?.scrollIntoView({ block: 'start' });
  form.elements.name.focus();
}

function buildDraftFromProduct(product) {
  const draft = createEmptyVariationDraft();

  product.colors.forEach((color) => {
    const colorDraft = createColorDraft({
      id: color.id,
      name: color.name,
      imageUrl: color.imageUrl,
      active: color.active,
      existing: true,
    });

    draft.colors.push(colorDraft);
    draft.lockedColorKeys.add(colorKey(colorDraft));

    (color.variations || []).forEach((variation) => {
      draft.sizes = [...new Set([...draft.sizes, variation.size])];
      draft.lockedSizes.add(variation.size);
      const key = variationKey(colorDraft, variation.size);
      draft.existingKeys.add(key);
      draft.cells[key] = {
        id: variation.id,
        product_color_id: color.id,
        colorKey: colorKey(colorDraft),
        size: variation.size,
        quantity: Number(variation.quantity || 0),
        minimum_stock: Number(variation.minimum_stock || 0),
        status: variation.status,
        existing: true,
      };
    });
  });

  return draft;
}

function closeProductModal(container) {
  const formPage = container.querySelector('[data-product-form-page]');
  const listView = container.querySelector('[data-products-list-view]');
  if (formPage) formPage.hidden = true;
  if (listView) listView.hidden = false;
  productState.editingProduct = null;
}

function renderVariationBuilder(container) {
  renderColorList(container);
  renderSizeOptions(container);
  renderVariationRows(container);
  syncProductStatusControl(container);
}

function renderColorList(container) {
  const colorList = container.querySelector('[data-color-list]');
  colorList.innerHTML = productState.variationDraft.colors.length
    ? productState.variationDraft.colors.map((color) => renderColorCard(color)).join('')
    : '<span class="muted-text">Nenhuma cor adicionada.</span>';
}

function renderColorCard(color) {
  const imageLabel = color.fileName || (color.imageUrl ? 'imagem cadastrada' : 'sem imagem');
  const imagePreview = color.imageUrl || getImagePlaceholder();

  return `
    <span class="color-chip ${color.existing ? 'color-chip--locked' : ''}">
      <img src="${escapeHtml(imagePreview)}" alt="Imagem da cor ${escapeHtml(color.name)}" />
      <strong>${escapeHtml(color.name)}</strong>
      <small>✓ ${escapeHtml(imageLabel)}</small>
      ${color.existing ? `
        <label class="color-chip__replace">
          Trocar imagem
          <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" data-replace-color-image="${colorKey(color)}" />
        </label>
      ` : `<button type="button" data-remove-color="${colorKey(color)}" aria-label="Remover cor ${escapeHtml(color.name)}">×</button>`}
    </span>
  `;
}

function renderSizeOptions(container) {
  container.querySelectorAll('[data-size-options] input').forEach((input) => {
    input.checked = productState.variationDraft.sizes.includes(input.value);
    input.disabled = productState.variationDraft.lockedSizes.has(input.value);
  });
}

function renderVariationRows(container) {
  const area = container.querySelector('[data-variation-table]');
  const selectedSizes = availableSizes.filter((size) => productState.variationDraft.sizes.includes(size));

  if (!productState.variationDraft.colors.length || !selectedSizes.length) {
    area.innerHTML = '<p class="variation-empty">Adicione pelo menos uma cor e selecione um tamanho para exibir a grade.</p>';
    renderVariationSummary(container);
    return;
  }

  area.innerHTML = `
    <div class="table-shell">
      <table class="variation-matrix">
        <thead>
          <tr>
            <th>Cor</th>
            ${selectedSizes.map((size) => `<th>${size}</th>`).join('')}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${productState.variationDraft.colors.map((color) => `
            <tr>
              <th scope="row">${escapeHtml(color.name)}</th>
              ${selectedSizes.map((size) => renderVariationCell(color, size)).join('')}
              <td><strong data-color-total="${escapeHtml(colorKey(color))}">${getColorDraftTotal(color, selectedSizes)}</strong></td>
            </tr>
          `).join('')}
          <tr class="variation-matrix__total">
            <th scope="row">Total geral</th>
            ${selectedSizes.map((size) => `<td><strong data-size-total="${escapeHtml(size)}">${getSizeDraftTotal(size)}</strong></td>`).join('')}
            <td><strong data-grand-total>${getVisibleVariationRows().reduce((total, row) => total + Number(row.quantity || 0), 0)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  renderVariationSummary(container);
}

function getColorDraftTotal(color, selectedSizes) {
  return selectedSizes.reduce((total, size) => {
    const cell = productState.variationDraft.cells[variationKey(color, size)];
    return total + Number(cell?.quantity || 0);
  }, 0);
}

function getSizeDraftTotal(size) {
  return productState.variationDraft.colors.reduce((total, color) => {
    const cell = productState.variationDraft.cells[variationKey(color, size)];
    return total + Number(cell?.quantity || 0);
  }, 0);
}

function updateVariationTotals(container) {
  const selectedSizes = availableSizes.filter((size) => productState.variationDraft.sizes.includes(size));

  productState.variationDraft.colors.forEach((color) => {
    const total = container.querySelector(`[data-color-total="${CSS.escape(colorKey(color))}"]`);
    if (total) total.textContent = getColorDraftTotal(color, selectedSizes);
  });

  selectedSizes.forEach((size) => {
    const total = container.querySelector(`[data-size-total="${CSS.escape(size)}"]`);
    if (total) total.textContent = getSizeDraftTotal(size);
  });

  const grandTotal = container.querySelector('[data-grand-total]');
  if (grandTotal) {
    grandTotal.textContent = getVisibleVariationRows().reduce((total, row) => total + Number(row.quantity || 0), 0);
  }
}

function renderVariationCell(color, size) {
  const key = variationKey(color, size);
  const cell = productState.variationDraft.cells[key];
  const disabled = productState.variationDraft.existingKeys.has(key);

  return `
    <td>
      <input
        type="number"
        min="0"
        step="1"
        value="${Number(cell?.quantity || 0)}"
        data-variation-cell="${escapeHtml(key)}"
        aria-label="Estoque inicial ${escapeHtml(color.name)} ${escapeHtml(size)}"
        ${disabled ? 'disabled' : ''}
      />
    </td>
  `;
}

function getVisibleVariationRows() {
  const selectedSizes = availableSizes.filter((size) => productState.variationDraft.sizes.includes(size));
  const rows = [];

  productState.variationDraft.colors.forEach((color) => {
    selectedSizes.forEach((size) => {
      const key = variationKey(color, size);
      const cell = productState.variationDraft.cells[key];
      rows.push({
        colorKey: colorKey(color),
        color,
        size,
        quantity: Number(cell?.quantity || 0),
        minimum_stock: Number(cell?.minimum_stock ?? productState.variationDraft.defaultMinimumStock),
        existing: productState.variationDraft.existingKeys.has(key),
      });
    });
  });

  return rows;
}

function renderVariationSummary(container) {
  const summary = container.querySelector('[data-variation-summary]');
  const form = container.querySelector('[data-product-form]');
  const rows = getVisibleVariationRows();
  const stockTotal = rows.reduce((total, row) => total + Number(row.quantity || 0), 0);
  const productName = form?.elements.name.value.trim() || 'Produto sem nome';
  const status = getStatusLabel(form?.elements.status.value || 'active');
  const statusClass = form?.elements.status.value === 'inactive' ? 'status-badge--inactive' : 'status-badge--active';
  const selectedSizes = availableSizes.filter((size) => productState.variationDraft.sizes.includes(size));

  summary.innerHTML = `
    <h5>Resumo</h5>
    <dl>
      <div><dt>Produto</dt><dd>${escapeHtml(productName)}</dd></div>
      <div><dt>Cores</dt><dd>${productState.variationDraft.colors.length}</dd></div>
      <div><dt>Tamanhos</dt><dd>${productState.variationDraft.sizes.length}</dd></div>
      <div>
        <dt>Tamanhos selecionados</dt>
        <dd class="products-summary-size-chips">
          ${selectedSizes.length
            ? selectedSizes.map((size) => `<span>${escapeHtml(size)}</span>`).join('')
            : '<small>Nenhum</small>'}
        </dd>
      </div>
      <div><dt>Variações</dt><dd>${rows.length}</dd></div>
      <div><dt>Estoque Inicial</dt><dd>${stockTotal} peças</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge ${statusClass}">${escapeHtml(status)}</span></dd></div>
    </dl>
  `;
}

function syncProductStatusControl(container) {
  const form = container.querySelector('[data-product-form]');
  const value = form?.elements.status.value || 'active';
  const switchButton = container.querySelector('[data-product-status-switch]');

  if (switchButton) {
    switchButton.classList.toggle('is-active', value === 'active');
    switchButton.setAttribute('aria-pressed', value === 'active' ? 'true' : 'false');
  }

  container.querySelectorAll('[data-product-status-option]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.productStatusOption === value);
  });
}

function addColor(container) {
  const colorInput = container.querySelector('[name="color_name"]');
  const colorImageInput = container.querySelector('[name="color_image"]');
  const fileStatus = container.querySelector('[data-color-file-status]');
  const colorName = normalizeName(colorInput.value);
  const file = colorImageInput.files?.[0] || null;
  const existingColor = productState.variationDraft.colors.find(
    (color) => color.name.toLowerCase() === colorName.toLowerCase(),
  );

  if (!colorName) {
    fileStatus.textContent = 'Informe o nome da cor.';
    return;
  }

  if (!file) {
    fileStatus.textContent = `Selecione uma imagem para a cor ${colorName}.`;
    return;
  }

  if (!isValidColorImage(file)) {
    fileStatus.textContent = 'Formato inválido. Use JPG, JPEG, PNG ou WEBP.';
    return;
  }

  if (existingColor) {
    existingColor.file = file;
    existingColor.fileName = file.name;
    fileStatus.textContent = 'Nenhum arquivo selecionado.';
    colorInput.value = '';
    colorImageInput.value = '';
    console.info('[Produtos] Arquivo de imagem anexado à cor existente:', {
      colorId: existingColor.id || null,
      colorName: existingColor.name,
      fileName: file.name,
    });
    renderVariationBuilder(container);
    return;
  }

  const colorDraft = createColorDraft({
    name: colorName,
    imageUrl: URL.createObjectURL(file),
    file,
  });
  colorDraft.file = file;
  colorDraft.fileName = file.name;

  productState.variationDraft.colors.push(colorDraft);
  colorInput.value = '';
  colorImageInput.value = '';
  const preview = container.querySelector('[data-color-upload-preview]');
  const uploadTitle = container.querySelector('[data-color-upload-title]');
  const uploadField = container.querySelector('.color-upload-field');
  const clearButton = container.querySelector('[data-clear-color-image]');
  if (preview) {
    preview.removeAttribute('src');
    preview.hidden = true;
  }
  if (uploadTitle) uploadTitle.textContent = 'Clique ou arraste a imagem da cor';
  uploadField?.classList.remove('is-uploading', 'is-ready');
  if (clearButton) clearButton.hidden = true;
  fileStatus.textContent = 'Nenhum arquivo selecionado.';
  ensureVariationCells();
  renderVariationBuilder(container);
}

function removeColor(container, key) {
  if (productState.variationDraft.lockedColorKeys.has(key)) return;

  productState.variationDraft.colors = productState.variationDraft.colors.filter((color) => colorKey(color) !== key);
  Object.keys(productState.variationDraft.cells).forEach((cellKey) => {
    if (cellKey.startsWith(`${key}|`) && !productState.variationDraft.existingKeys.has(cellKey)) {
      delete productState.variationDraft.cells[cellKey];
    }
  });
  renderVariationBuilder(container);
}

function syncSelectedSizes(container) {
  productState.variationDraft.sizes = [...container.querySelectorAll('[data-size-options] input:checked')]
    .map((input) => input.value);
  ensureVariationCells();
}

function ensureVariationCells() {
  productState.variationDraft.colors.forEach((color) => {
    productState.variationDraft.sizes.forEach((size) => {
      const key = variationKey(color, size);
      if (!productState.variationDraft.cells[key]) {
        productState.variationDraft.cells[key] = {
          colorKey: colorKey(color),
          size,
          quantity: 0,
          minimum_stock: productState.variationDraft.defaultMinimumStock,
          status: 'active',
          existing: false,
        };
      }
    });
  });
}

function syncVariationInputs(container) {
  const defaultMinimumInput = container.querySelector('[data-default-minimum-stock]');
  productState.variationDraft.defaultMinimumStock = Math.max(0, Number(defaultMinimumInput?.value || 0));

  container.querySelectorAll('[data-variation-cell]').forEach((input) => {
    const key = input.dataset.variationCell;
    const cell = productState.variationDraft.cells[key];
    if (cell && !productState.variationDraft.existingKeys.has(key)) {
      cell.quantity = Math.max(0, Number(input.value || 0));
      cell.minimum_stock = productState.variationDraft.defaultMinimumStock;
    }
  });
}

function getNewVariationRows(colorIdMap) {
  const seen = new Set();

  return getVisibleVariationRows().filter((row) => {
    const key = `${colorIdMap.get(row.colorKey)}|${row.size}`;
    if (row.existing || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getColorImagePath(productId, colorName) {
  return `products/${productId}/colors/${slugify(colorName)}.webp`;
}

async function convertImageToWebp(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Não foi possível converter a imagem para WEBP.'));
    }, 'image/webp', 0.9);
  });
}

async function uploadColorImage(productId, color) {
  if (!color.file) {
    console.info('[Produtos] Upload de imagem da cor ignorado: sem novo arquivo.', {
      productId,
      colorName: color.name,
      currentImageUrl: color.imageUrl || null,
    });
    return color.imageUrl || null;
  }

  const path = getColorImagePath(productId, color.name);
  console.info('[Produtos] Upload da imagem da cor - path:', {
    bucket: colorImageBucket,
    path,
    productId,
    colorName: color.name,
    fileName: color.file.name,
  });

  const webpBlob = await convertImageToWebp(color.file);
  const { error: uploadError } = await supabase.storage
    .from(colorImageBucket)
    .upload(path, webpBlob, {
      cacheControl: '3600',
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadError) {
    console.error('[Produtos] Erro no upload da imagem da cor:', uploadError);
    throwSupabaseStepError('upload product-images', buildStorageUploadError(uploadError, color.name), {
      bucket: colorImageBucket,
      path,
      colorName: color.name,
      productId,
    });
  }

  const { data } = supabase.storage.from(colorImageBucket).getPublicUrl(path);
  console.info('[Produtos] Public URL retornada para imagem da cor:', {
    bucket: colorImageBucket,
    path,
    publicUrl: data?.publicUrl || null,
  });

  return data.publicUrl;
}

async function saveProductColors(productId) {
  const colorIdMap = new Map();

  for (const color of productState.variationDraft.colors) {
    if (color.id) {
      if (!color.file && !color.imageUrl) {
        throw buildMissingColorImageError(color.name);
      }

      const imageUrl = await uploadColorImage(productId, color);
      const payload = {
        color_name: color.name,
        active: color.active !== false,
      };

      if (imageUrl) payload.image_url = imageUrl;

      const { data: updatedColor, error } = await supabase
        .from('product_colors')
        .update(payload)
        .eq('id', color.id)
        .select('id, color_name, image_url')
        .single();

      if (error) {
        throwSupabaseStepError('update product_colors', error, {
          colorId: color.id,
          productId,
          payload,
        });
      }

      console.info('[Produtos] Resultado do update em product_colors:', {
        colorId: color.id,
        productId,
        payload,
        savedImageUrl: updatedColor?.image_url || null,
        result: updatedColor,
      });
      colorIdMap.set(colorKey(color), color.id);
      continue;
    }

    if (!color.file) {
      throw buildMissingColorImageError(color.name);
    }

    const imageUrl = await uploadColorImage(productId, color);
    const { data, error } = await supabase
      .from('product_colors')
      .insert({
        product_id: productId,
        color_name: color.name,
        image_url: imageUrl,
        active: true,
      })
      .select('id, color_name, image_url')
      .single();

    if (error) {
      throwSupabaseStepError('insert product_colors', error, {
        productId,
        colorName: color.name,
        imageUrl,
      });
    }

    console.info('[Produtos] Resultado do insert em product_colors:', {
      colorId: data.id,
      productId,
      colorName: color.name,
      imageUrl,
      savedImageUrl: data.image_url,
    });
    colorIdMap.set(colorKey(color), data.id);
  }

  return colorIdMap;
}

async function saveProduct(container, event) {
  event.preventDefault();

  if (!productState.isAdmin) return;

  const form = event.currentTarget;
  const message = container.querySelector('[data-product-message]');
  const formData = new FormData(form);
  syncVariationInputs(container);

  const payload = {
    name: formData.get('name')?.toString().trim(),
    description: formData.get('description')?.toString().trim() || null,
    sku: formData.get('sku')?.toString().trim() || null,
    sale_price: parseMoney(formData.get('sale_price')),
    status: formData.get('status')?.toString() || 'active',
  };

  if (form.elements.cost_price) {
    payload.cost_price = parseMoney(formData.get('cost_price'));
  }

  if (!payload.name) {
    message.textContent = 'Informe o nome do produto.';
    return;
  }

  message.textContent = 'Salvando...';

  try {
    const editingProduct = productState.editingProduct;
    let productId = editingProduct?.id;

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id);

      if (error) {
        throwSupabaseStepError('update products', error, {
          productId: editingProduct.id,
          payload,
        });
      }
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...payload,
          created_by: productState.profile?.id || null,
        })
        .select('id')
        .single();

      if (error) {
        throwSupabaseStepError('insert products', error, {
          payload: {
            ...payload,
            created_by: productState.profile?.id || null,
          },
        });
      }
      productId = data.id;
    }

    const colorIdMap = await saveProductColors(productId);
    const newVariations = getNewVariationRows(colorIdMap);

    if (newVariations.length) {
      const { error } = await supabase
        .from('product_variations')
        .insert(newVariations.map((variation) => ({
          product_id: productId,
          product_color_id: colorIdMap.get(variation.colorKey),
          color: variation.color.name,
          size: variation.size,
          quantity: variation.quantity,
          minimum_stock: variation.minimum_stock,
          status: 'active',
        })));

      if (error) {
        throwSupabaseStepError('insert product_variations', error, {
          productId,
          variations: newVariations.map((variation) => ({
            product_id: productId,
            product_color_id: colorIdMap.get(variation.colorKey),
            color: variation.color.name,
            size: variation.size,
            quantity: variation.quantity,
            minimum_stock: variation.minimum_stock,
            status: 'active',
          })),
        });
      }
    }

    // TODO: chamar helper de auditoria aqui quando o módulo de auditoria estiver disponível.
    closeProductModal(container);
    await loadProducts(container);
  } catch (error) {
    const formattedError = formatSupabaseError(error);
    console.group('Falha geral em saveProduct');
    console.error('Objeto completo:', formattedError.object);
    console.error('message:', formattedError.message);
    console.error('details:', formattedError.details);
    console.error('hint:', formattedError.hint);
    console.error('code:', formattedError.code);
    console.error('statusCode:', formattedError.statusCode);
    console.error('step:', error?.step || null);
    console.error('context:', error?.context || null);
    console.groupEnd();
    const stepLabel = error?.step ? ` (${error.step})` : '';
    message.textContent = error?.userMessageOnly
      ? formattedError.message
      : `Erro ao salvar${stepLabel}: ${formattedError.message}`;
  }
}

async function toggleProductStatus(container, productId, nextStatus) {
  if (!productState.isAdmin) return;

  const { error } = await supabase
    .from('products')
    .update({ status: nextStatus })
    .eq('id', productId);

  if (error) {
    console.error('Erro ao atualizar status do produto:', error.message);
    setTableError(container, 'Não foi possível atualizar o status do produto.');
    return;
  }

  // TODO: chamar helper de auditoria aqui quando o módulo de auditoria estiver disponível.
  await loadProducts(container);
}

function bindProductsEvents(container) {
  const filtersForm = container.querySelector('[data-products-filters]');
  const signal = productState.abortController.signal;

  filtersForm.addEventListener('input', () => {
    productState.filters.search = filtersForm.elements.search.value;
    productState.filters.category = filtersForm.elements.category.value;
    productState.filters.color = filtersForm.elements.color.value;
    productState.filters.stock = 'all';
    productState.filters.status = filtersForm.elements.status.value;
    renderTable(container);
  }, { signal });

  filtersForm.addEventListener('change', () => {
    productState.filters.search = filtersForm.elements.search.value;
    productState.filters.category = filtersForm.elements.category.value;
    productState.filters.color = filtersForm.elements.color.value;
    productState.filters.stock = 'all';
    productState.filters.status = filtersForm.elements.status.value;
    renderTable(container);
  }, { signal });

  container.querySelector('[data-new-product]')?.addEventListener('click', () => {
    openProductModal(container);
  }, { signal });

  container.querySelector('[data-import-products]')?.addEventListener('click', () => {
    alert('Importação de produtos ainda não está disponível neste fluxo.');
  }, { signal });

  container.querySelector('[data-product-form]')?.addEventListener('submit', (event) => {
    saveProduct(container, event);
  }, { signal });

  container.querySelectorAll('[data-close-product-modal]').forEach((button) => {
    button.addEventListener('click', () => closeProductModal(container), { signal });
  });

  container.querySelector('[data-add-color]')?.addEventListener('click', () => {
    addColor(container);
  }, { signal });

  container.querySelector('[name="color_name"]')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addColor(container);
    }
  }, { signal });

  container.querySelector('[name="color_image"]')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0] || null;
    const fileStatus = container.querySelector('[data-color-file-status]');
    fileStatus.textContent = file ? `✓ Arquivo selecionado: ${file.name}` : 'Nenhum arquivo selecionado.';
  }, { signal });

  container.querySelector('[name="color_image"]')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0] || null;
    const field = container.querySelector('.color-upload-field');
    const preview = container.querySelector('[data-color-upload-preview]');
    const title = container.querySelector('[data-color-upload-title]');
    const fileStatus = container.querySelector('[data-color-file-status]');
    const clearButton = container.querySelector('[data-clear-color-image]');

    if (file && isValidColorImage(file)) {
      field?.classList.remove('is-uploading');
      field?.classList.add('is-ready');
      if (preview) {
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
      }
      if (title) title.textContent = file.name;
      if (fileStatus) fileStatus.textContent = 'Upload finalizado. Imagem pronta para adicionar.';
      if (clearButton) clearButton.hidden = false;
      return;
    }

    field?.classList.remove('is-uploading', 'is-ready');
    if (preview) {
      preview.removeAttribute('src');
      preview.hidden = true;
    }
    if (title) title.textContent = 'Clique ou arraste a imagem da cor';
    if (fileStatus) fileStatus.textContent = file ? 'Formato invalido. Use PNG, JPG ou WEBP.' : 'PNG, JPG ou WEBP ate 5MB';
    if (clearButton) clearButton.hidden = true;
  }, { signal });

  container.querySelector('[data-clear-color-image]')?.addEventListener('click', () => {
    const input = container.querySelector('[name="color_image"]');
    const field = container.querySelector('.color-upload-field');
    const preview = container.querySelector('[data-color-upload-preview]');
    const title = container.querySelector('[data-color-upload-title]');
    const fileStatus = container.querySelector('[data-color-file-status]');
    const clearButton = container.querySelector('[data-clear-color-image]');

    if (input) input.value = '';
    field?.classList.remove('is-uploading', 'is-ready');
    if (preview) {
      preview.removeAttribute('src');
      preview.hidden = true;
    }
    if (title) title.textContent = 'Clique ou arraste a imagem da cor';
    if (fileStatus) fileStatus.textContent = 'PNG, JPG ou WEBP ate 5MB';
    if (clearButton) clearButton.hidden = true;
  }, { signal });

  const colorUploadField = container.querySelector('.color-upload-field');
  if (colorUploadField) {
    colorUploadField.addEventListener('pointerdown', () => {
      colorUploadField.classList.add('is-uploading');
    }, { signal });

    colorUploadField.addEventListener('pointerleave', () => {
      colorUploadField.classList.remove('is-uploading');
    }, { signal });

    colorUploadField.addEventListener('dragover', (event) => {
      event.preventDefault();
      colorUploadField.classList.add('is-uploading');
    }, { signal });

    colorUploadField.addEventListener('dragleave', () => {
      colorUploadField.classList.remove('is-uploading');
    }, { signal });
  }

  container.querySelector('[data-size-options]')?.addEventListener('change', () => {
    syncSelectedSizes(container);
    renderVariationBuilder(container);
  }, { signal });

  container.querySelector('[data-default-minimum-stock]')?.addEventListener('input', () => {
    syncVariationInputs(container);
    renderVariationBuilder(container);
  }, { signal });

  container.addEventListener('input', (event) => {
    if (event.target.matches('[data-variation-cell]')) {
      syncVariationInputs(container);
      updateVariationTotals(container);
      renderVariationSummary(container);
      return;
    }

    if (event.target.matches('[name="name"], [name="status"]')) {
      renderVariationSummary(container);
    }
  }, { signal });

  container.addEventListener('change', (event) => {
    if (!event.target.matches('[data-replace-color-image]')) return;

    const key = event.target.dataset.replaceColorImage;
    const color = productState.variationDraft.colors.find((item) => colorKey(item) === key);
    const file = event.target.files?.[0] || null;
    if (color && isValidColorImage(file)) {
      color.file = file;
      color.fileName = file.name;
      console.info('[Produtos] Arquivo de troca de imagem salvo no estado da cor:', {
        colorId: color.id || null,
        colorName: color.name,
        fileName: file.name,
      });
      renderColorList(container);
      return;
    }

    if (color && file) {
      console.error('[Produtos] Arquivo de troca de imagem inválido:', {
        colorId: color.id || null,
        colorName: color.name,
        fileName: file.name,
        fileType: file.type,
      });
    }
  }, { signal });

  container.addEventListener('click', (event) => {
    const filterTrigger = event.target.closest('[data-product-filter-trigger]');
    const filterOption = event.target.closest('[data-product-filter-option]');
    const productDetailsButton = event.target.closest('[data-toggle-product-details]');
    const statusFilterButton = event.target.closest('[data-product-status-filter]');
    const stockFilterButton = event.target.closest('[data-product-stock-filter]');
    const removeColorButton = event.target.closest('[data-remove-color]');
    const editButton = event.target.closest('[data-edit-product]');
    const toggleButton = event.target.closest('[data-toggle-product]');
    const duplicateButton = event.target.closest('[data-duplicate-product]');
    const emptyNewProductButton = event.target.closest('[data-empty-new-product]');
    const productStatusOption = event.target.closest('[data-product-status-option]');
    const productStatusSwitch = event.target.closest('[data-product-status-switch]');

    if (emptyNewProductButton) {
      openProductModal(container);
      return;
    }

    if (productStatusSwitch) {
      const form = container.querySelector('[data-product-form]');
      if (form?.elements.status) {
        form.elements.status.value = form.elements.status.value === 'active' ? 'inactive' : 'active';
        syncProductStatusControl(container);
        renderVariationSummary(container);
      }
      return;
    }

    if (productStatusOption) {
      const form = container.querySelector('[data-product-form]');
      if (form?.elements.status) {
        form.elements.status.value = productStatusOption.dataset.productStatusOption;
        syncProductStatusControl(container);
        renderVariationSummary(container);
      }
      return;
    }

    if (filterTrigger) {
      const name = filterTrigger.dataset.productFilterTrigger;
      const field = filterTrigger.closest('[data-product-filter-field]');
      const isOpen = field?.classList.contains('is-open');
      closeProductFilterMenus(container, isOpen ? '' : name);
      return;
    }

    if (filterOption) {
      const name = filterOption.dataset.productFilterOption;
      productState.filters[name] = filterOption.dataset.value;
      productState.filters.stock = 'all';
      closeProductFilterMenus(container);
      renderTable(container);
      return;
    }

    if (!event.target.closest('[data-product-filter-field]')) {
      closeProductFilterMenus(container);
    }

    if (statusFilterButton) {
      productState.filters.status = statusFilterButton.dataset.productStatusFilter;
      productState.filters.stock = 'all';
      filtersForm.elements.status.value = productState.filters.status;
      renderTable(container);
      return;
    }

    if (stockFilterButton) {
      productState.filters.status = 'all';
      productState.filters.stock = stockFilterButton.dataset.productStockFilter;
      filtersForm.elements.status.value = 'all';
      renderTable(container);
      return;
    }

    if (productDetailsButton) {
      const productId = productDetailsButton.dataset.toggleProductDetails;
      if (productState.expandedProducts.has(productId)) {
        productState.expandedProducts.delete(productId);
      } else {
        productState.expandedProducts.add(productId);
      }
      renderTable(container);
      return;
    }

    if (removeColorButton) {
      removeColor(container, removeColorButton.dataset.removeColor);
      return;
    }

    if (editButton) {
      openProductModal(container, getProductById(editButton.dataset.editProduct));
      return;
    }

    if (duplicateButton) {
      alert('Duplicar produto ainda depende de selecionar novas imagens para as cores. Use Editar como base por enquanto.');
      return;
    }

    if (toggleButton) {
      toggleProductStatus(container, toggleButton.dataset.toggleProduct, toggleButton.dataset.nextStatus);
    }
  }, { signal });
}

export function renderProducts(container, route, { profile }) {
  productState.abortController?.abort();
  productState.abortController = new AbortController();
  productState.profile = profile;
  productState.isAdmin = isAdmin(profile);
  productState.filters = { search: '', category: 'all', color: 'all', stock: 'all', status: 'all' };
  productState.editingProduct = null;
  productState.variationDraft = createEmptyVariationDraft();

  renderProductsLayout(container, route);
  bindProductsEvents(container);
  loadProducts(container);
}
