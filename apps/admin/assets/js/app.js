import { logout } from './auth.js';
import { getBrandLogoSrc } from './config/branding.js';
import { isAdmin, requireAuth } from './permissions.js';
import { initRouter } from './router.js';
import { supabase } from './supabaseClient.js';

const roleLabels = {
  admin: 'Administrador',
  seller: 'Vendedor',
};

const orderStatusLabels = {
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  in_separation: 'Em separação',
  awaiting_shipping: 'Aguardando envio',
  shipped: 'Enviado',
  delivered: 'Entregue',
  finalized: 'Finalizado',
  cancelled: 'Cancelado',
};

let globalSearchRequestId = 0;

function ensureToastRegion() {
  let region = document.querySelector('[data-toast-region]');
  if (region) return region;

  region = document.createElement('div');
  region.className = 'ds-toast-region';
  region.setAttribute('data-toast-region', '');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

function showToast(message, tone = 'success') {
  const region = ensureToastRegion();
  const toast = document.createElement('article');
  toast.className = `ds-toast ds-toast--${tone}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="ds-toast__icon" aria-hidden="true">${tone === 'danger' ? '!' : tone === 'warning' ? '•' : '✓'}</span>
    <div>
      <strong>${escapeHtml(message)}</strong>
    </div>
    <button type="button" class="ds-toast__close" aria-label="Fechar">×</button>
  `;

  const close = () => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 160);
  };

  toast.querySelector('.ds-toast__close')?.addEventListener('click', close);
  region.appendChild(toast);
  window.requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(close, 3200);
  return toast;
}

window.vbAdminToast = showToast;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function debounce(callback, delay = 220) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

function sanitizeSearchTerm(value) {
  return String(value || '').trim().replace(/[,'()]/g, ' ').replace(/\s+/g, ' ');
}

function formatSaleNumber(sale) {
  const number = sale?.formatted_operation_number || String(sale?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `VD-${number}` : 'VD-00000';
}

function formatOrderNumber(order) {
  const number = order?.formatted_operation_number || String(order?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `PD-${number}` : 'PD-00000';
}

function getProductColorImages(product) {
  if (Array.isArray(product?.color_images)) return product.color_images;
  if (typeof product?.color_images === 'string') {
    try {
      const parsed = JSON.parse(product.color_images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getProductSearchImage(product) {
  return getProductColorImages(product).find((color) => color?.image_url)?.image_url || product?.image_url || '';
}

function getProductSearchColor(product) {
  return getProductColorImages(product).find((color) => color?.color_name)?.color_name || '';
}

function getProductSearchReference(product) {
  return String(product?.sku || '').replace(/^(?:ref\.?\s*:?\s*)+/i, '').trim();
}

async function safeData(query, fallback = []) {
  const { data, error } = await query;
  if (error) {
    console.warn('Consulta global indisponível:', error.message);
    return fallback;
  }
  return data || fallback;
}

async function loadGlobalProductResults(pattern) {
  const extended = await supabase.from('vw_products_seller')
    .select('id, name, sku, image_url, status, stock_total, color_images')
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(5);

  if (!extended.error) return extended.data || [];

  console.warn('Busca de produtos sem dados de cor/imagem:', extended.error.message);
  return safeData(
    supabase.from('vw_products_seller')
      .select('id, name, sku, image_url, status')
      .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
      .order('name', { ascending: true })
      .limit(5),
  );
}

function formatUserName(profile) {
  return profile?.name || profile?.email || 'Usuário';
}

function formatRole(profile) {
  return roleLabels[profile?.role] || profile?.role || 'Perfil não informado';
}

function getInitials(profile) {
  const name = formatUserName(profile);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'US';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function setupUserSummary(profile) {
  const userName = document.querySelector('#user-name');
  const userRole = document.querySelector('#user-role');
  const userAvatar = document.querySelector('#user-avatar');
  const sidebarUserName = document.querySelector('[data-sidebar-user-name]');
  const sidebarUserRole = document.querySelector('[data-sidebar-user-role]');
  const sidebarUserAvatar = document.querySelector('[data-sidebar-user-avatar]');
  const initials = getInitials(profile);

  userName.textContent = formatUserName(profile);
  userRole.textContent = formatRole(profile);
  if (userAvatar) {
    userAvatar.textContent = initials;
  }
  if (sidebarUserName) {
    sidebarUserName.textContent = formatUserName(profile);
  }
  if (sidebarUserRole) {
    sidebarUserRole.textContent = formatRole(profile);
  }
  if (sidebarUserAvatar) {
    sidebarUserAvatar.textContent = initials;
  }
}

function setupPermissions(profile) {
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.hidden = !isAdmin(profile);
  });
}

function applyCompanyBrand() {
  const brandLight = document.querySelector('[data-company-logo-mark-light]');
  const brandIcon = document.querySelector('[data-company-logo-mark-icon]');
  const topbarLogo = document.querySelector('[data-topbar-brand-logo]');

  function setLogo(target, src) {
    if (!target) return;
    target.innerHTML = '';
    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    image.className = 'brand-mark__image';
    target.appendChild(image);
  }

  setLogo(brandLight, getBrandLogoSrc('light'));
  setLogo(brandIcon, getBrandLogoSrc('icon'));

  if (topbarLogo) {
    topbarLogo.src = getBrandLogoSrc('dark');
    topbarLogo.alt = 'Veste Bem';
    topbarLogo.hidden = false;
  }
}

async function setupCompanyBrand() {
  applyCompanyBrand();
}

function bindCompanyBrandUpdates() {
  window.addEventListener('company-settings-updated', () => {
    applyCompanyBrand();
  });
}

function setupLogout() {
  document.querySelectorAll('[data-logout-button]').forEach((logoutButton) => {
    logoutButton.addEventListener('click', async () => {
      await logout();
    });
  });
}

function setupUserMenu() {
  const menu = document.querySelector('[data-user-menu]');
  const trigger = document.querySelector('[data-user-menu-trigger]');
  const panel = document.querySelector('[data-user-menu-panel]');

  if (!menu || !trigger || !panel) return;

  function closeMenu() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    trigger.setAttribute('aria-expanded', String(nextOpen));
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu();
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

function setupSidebar() {
  const toggleButton = document.querySelector('[data-sidebar-toggle]');
  const backdrop = document.querySelector('[data-sidebar-backdrop]');
  const mobileMenuQuery = window.matchMedia('(max-width: 900px)');

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (backdrop) backdrop.hidden = true;
    toggleButton?.setAttribute('aria-expanded', 'false');
  }

  function openSidebar() {
    if (!mobileMenuQuery.matches) return;
    document.body.classList.add('sidebar-open');
    if (backdrop) backdrop.hidden = false;
    toggleButton?.setAttribute('aria-expanded', 'true');
  }

  toggleButton?.setAttribute('aria-expanded', 'false');

  toggleButton?.addEventListener('click', () => {
    if (document.body.classList.contains('sidebar-open')) {
      closeSidebar();
      return;
    }

    openSidebar();
  });

  backdrop?.addEventListener('click', closeSidebar);

  document.querySelectorAll('[data-route-link]').forEach((link) => {
    link.addEventListener('click', closeSidebar);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSidebar();
    }
  });

  mobileMenuQuery.addEventListener('change', (event) => {
    if (!event.matches) {
      closeSidebar();
    }
  });
}

function renderGlobalSearchPanel(panel, groups, message = '') {
  const visibleGroups = groups.filter((group) => group.items.length);
  if (message) {
    panel.innerHTML = `<p class="global-search-empty">${escapeHtml(message)}</p>`;
    panel.hidden = false;
    return;
  }

  if (!visibleGroups.length) {
    panel.innerHTML = '<p class="global-search-empty">Nenhum resultado encontrado.</p>';
    panel.hidden = false;
    return;
  }

  panel.innerHTML = visibleGroups.map((group) => `
    <section class="global-search-group">
      <h3>${escapeHtml(group.label)}</h3>
      ${group.items.map((item) => `
        <button class="global-search-result ${item.imageUrl !== undefined ? 'global-search-result--media' : ''}" type="button" data-global-search-route="${escapeHtml(item.route)}">
          ${item.imageUrl !== undefined ? `
            <span class="global-search-thumb">
              ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy">` : '<b>VB</b>'}
            </span>
          ` : ''}
          <span class="global-search-type">${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </button>
      `).join('')}
    </section>
  `).join('');
  panel.hidden = false;
}

async function loadGlobalSearchResults(term) {
  const query = sanitizeSearchTerm(term);
  const pattern = `%${query}%`;

  const [products, customers, sales, orders] = await Promise.all([
    loadGlobalProductResults(pattern),
    safeData(
      supabase.from('customers')
        .select('id, name, whatsapp, city')
        .or(`name.ilike.${pattern},whatsapp.ilike.${pattern},city.ilike.${pattern}`)
        .order('name', { ascending: true })
        .limit(5),
    ),
    safeData(
      supabase.from('vw_sales_seller')
        .select('id, operation_number, formatted_operation_number, customer_name, net_total')
        .or(`formatted_operation_number.ilike.${pattern},customer_name.ilike.${pattern}`)
        .order('operation_number', { ascending: false })
        .limit(5),
    ),
    safeData(
      supabase.from('vw_orders_operational')
        .select('id, operation_number, formatted_operation_number, customer_name, order_status')
        .or(`formatted_operation_number.ilike.${pattern},customer_name.ilike.${pattern}`)
        .order('operation_number', { ascending: false })
        .limit(5),
    ),
  ]);

  return [
    {
      label: 'Produtos',
      items: products.map((product) => ({
        type: 'Produto',
        title: product.name || 'Produto',
        detail: [
          getProductSearchReference(product) ? `REF.: ${getProductSearchReference(product)}` : '',
          getProductSearchColor(product),
          product.stock_total !== undefined ? `${Number(product.stock_total || 0)} em estoque` : 'Produto ativo',
        ].filter(Boolean).join(' - '),
        imageUrl: getProductSearchImage(product),
        route: '#/produtos',
      })),
    },
    {
      label: 'Clientes',
      items: customers.map((customer) => ({
        type: 'Cliente',
        title: customer.name || 'Cliente',
        detail: [customer.whatsapp, customer.city].filter(Boolean).join(' / ') || 'Cadastro de cliente',
        route: '#/clientes',
      })),
    },
    {
      label: 'Vendas',
      items: sales.map((sale) => ({
        type: 'Venda',
        title: formatSaleNumber(sale),
        detail: `${sale.customer_name || 'Cliente'} - ${currency(sale.net_total)}`,
        route: `#/vendas?saleId=${encodeURIComponent(sale.id)}`,
      })),
    },
    {
      label: 'Pedidos',
      items: orders.map((order) => ({
        type: 'Pedido',
        title: formatOrderNumber(order),
        detail: `${order.customer_name || 'Cliente'} - ${orderStatusLabels[order.order_status] || order.order_status || 'Status'}`,
        route: `#/pedidos?orderId=${encodeURIComponent(order.id)}`,
      })),
    },
  ];
}

function setupGlobalSearch() {
  const root = document.querySelector('[data-global-search]');
  const input = document.querySelector('[data-global-search-input]');
  const panel = document.querySelector('[data-global-search-panel]');
  if (!root || !input || !panel) return;

  function closeSearch() {
    panel.hidden = true;
  }

  function navigateTo(route) {
    window.location.hash = route;
    input.value = '';
    closeSearch();
  }

  const runSearch = debounce(async () => {
    const term = input.value.trim();
    const requestId = ++globalSearchRequestId;

    if (term.length < 2) {
      closeSearch();
      return;
    }

    renderGlobalSearchPanel(panel, [], 'Buscando...');
    const groups = await loadGlobalSearchResults(term);
    if (requestId !== globalSearchRequestId) return;
    renderGlobalSearchPanel(panel, groups);
  });

  input.addEventListener('input', runSearch);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSearch();
      input.blur();
      return;
    }

    if (event.key === 'Enter' && !panel.hidden) {
      const firstResult = panel.querySelector('[data-global-search-route]');
      if (firstResult) {
        event.preventDefault();
        navigateTo(firstResult.dataset.globalSearchRoute);
      }
    }
  });

  panel.addEventListener('click', (event) => {
    const result = event.target.closest('[data-global-search-route]');
    if (result) navigateTo(result.dataset.globalSearchRoute);
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) closeSearch();
  });
}

function expenseDueDate(expense) {
  const notes = String(expense?.notes || '');
  const match = notes.match(/\[Vencimento\]\n([^\n]+)/);
  return expense?.due_date || (match?.[1] && match[1] !== '-' ? match[1] : '') || expense?.expense_date || '';
}

function isExpenseOverdue(expense) {
  if (expense?.deleted_at || expense?.status === 'cancelled' || expense?.status === 'paid') return false;
  if (expense?.status === 'overdue') return true;
  const dueDate = expenseDueDate(expense);
  return Boolean(dueDate) && String(dueDate).slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function renderNotifications(panel, items) {
  const activeItems = items.filter((item) => item.count > 0);

  panel.innerHTML = `
    <div class="notifications-panel__header">
      <strong>Notificações</strong>
    </div>
    ${activeItems.length ? `
      <div class="notifications-list">
        ${activeItems.map((item) => `
          <article class="notification-item">
            <span>${escapeHtml(item.count)}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.description)}</small>
            </div>
            <a href="${escapeHtml(item.href)}">Ver</a>
          </article>
        `).join('')}
      </div>
    ` : '<p class="notifications-empty">Tudo em dia.</p>'}
  `;
}

async function loadNotificationItems(admin) {
  const [orders, stockRows, expenses] = await Promise.all([
    safeData(supabase.from('orders').select('order_status, payment_status').limit(1000)),
    safeData(supabase.from('vw_stock_seller').select('quantity, minimum_stock').limit(1000)),
    admin ? safeData(supabase.from('expenses').select('*').limit(1000)) : Promise.resolve([]),
  ]);

  const awaitingPayment = orders.filter((order) => order.order_status === 'awaiting_payment' || order.payment_status === 'pending').length;
  const awaitingShipping = orders.filter((order) => order.order_status === 'awaiting_shipping').length;
  const outOfStock = stockRows.filter((row) => Number(row.quantity || 0) <= 0).length;
  const lowStock = stockRows.filter((row) => Number(row.quantity || 0) > 0 && Number(row.quantity || 0) <= Number(row.minimum_stock || 0)).length;
  const overdueExpenses = expenses.filter(isExpenseOverdue).length;

  return [
    {
      title: 'Pedidos aguardando pagamento',
      count: awaitingPayment,
      description: 'Pedidos ainda sem pagamento confirmado.',
      href: '#/pedidos?status=awaiting_payment',
    },
    {
      title: 'Pedidos aguardando envio',
      count: awaitingShipping,
      description: 'Pedidos prontos para envio.',
      href: '#/pedidos?status=awaiting_shipping',
    },
    {
      title: 'Produtos sem estoque',
      count: outOfStock,
      description: 'Variações com quantidade zerada.',
      href: '#/estoque?status=out',
    },
    {
      title: 'Produtos abaixo do mínimo',
      count: lowStock,
      description: 'Itens que precisam de reposição.',
      href: '#/estoque?status=low',
    },
    {
      title: 'Despesas vencidas',
      count: admin ? overdueExpenses : 0,
      description: 'Pagamentos pendentes fora do prazo.',
      href: '#/financeiro?status=overdue',
    },
  ];
}

function setupNotifications(profile) {
  const trigger = document.querySelector('.notification-button');
  const badge = trigger?.querySelector('span');
  if (!trigger || !badge) return;

  const panel = document.createElement('div');
  panel.className = 'notifications-panel';
  panel.hidden = true;
  trigger.parentElement.appendChild(panel);
  trigger.setAttribute('aria-expanded', 'false');

  function closePanel() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    trigger.setAttribute('aria-expanded', String(nextOpen));
  }

  async function refreshNotifications() {
    const items = await loadNotificationItems(isAdmin(profile));
    const total = items.filter((item) => item.count > 0).length;
    badge.textContent = String(total);
    badge.hidden = total === 0;
    renderNotifications(panel, items);
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel();
  });

  panel.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link) closePanel();
  });

  document.addEventListener('click', (event) => {
    if (!trigger.contains(event.target) && !panel.contains(event.target)) closePanel();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  refreshNotifications();
  window.addEventListener('hashchange', refreshNotifications);
}

async function initApp() {
  setupSidebar();

  const profile = await requireAuth('login.html');
  if (!profile) {
    return;
  }

  setupUserSummary(profile);
  setupPermissions(profile);
  setupCompanyBrand();
  bindCompanyBrandUpdates();
  setupLogout();
  setupUserMenu();
  setupGlobalSearch();
  setupNotifications(profile);
  initRouter(profile);
}

initApp();

