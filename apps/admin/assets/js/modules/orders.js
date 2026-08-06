import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';
import { bindPeriodSegmentedControl, renderPeriodSegmentedControl, getPeriodRange } from '../period.js';

const orderState = {
  profile: null,
  isAdmin: false,
  orders: [],
  orderItems: [],
  tracking: [],
  customers: [],
  viewingOrder: null,
  trackingOrder: null,
  abortController: null,
  page: 1,
  pageSize: 5,
  filters: {
    customer: '',
    cpf: '',
    whatsapp: '',
    email: '',
    number: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    tracking: '',
    invoice: 'all',
    origin: 'all',
    payment: 'all',
    shipping: 'all',
  },
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
  expired: 'Expirado',
};

const paymentStatusLabels = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const paymentLabels = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
};

const originLabels = {
  site: 'Site',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  manual: 'Manual futuro',
};

const timelineSteps = [
  ['awaiting_payment', 'Pedido criado'],
  ['paid', 'Pagamento confirmado'],
  ['in_separation', 'Em separação'],
  ['awaiting_shipping', 'Aguardando envio'],
  ['shipped', 'Enviado'],
  ['delivered', 'Entregue'],
  ['finalized', 'Finalizado'],
  ['cancelled', 'Cancelado'],
];

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

function orderIcon(name) {
  const icons = {
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    package: '<path d="m3 7 9-5 9 5v10l-9 5-9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h.01"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] || icons.receipt}</svg>`;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatOrderOperationNumber(order) {
  const number = order?.formatted_operation_number || String(order?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `PD-${number}` : 'PD-00000';
}

function formatDateOnly(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatReservationRemaining(value) {
  const minutes = Math.max(0, Math.floor((new Date(value).getTime() - Date.now()) / 60000));
  if (!minutes) return 'Reserva expirada';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function getOrderItems(orderId) {
  return orderState.orderItems.filter((item) => item.order_id === orderId);
}

function getOrderTracking(orderId) {
  return orderState.tracking
    .filter((item) => item.order_id === orderId)
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

function getLatestTracking(orderId) {
  return getOrderTracking(orderId)[0] || null;
}

function getOrderCustomer(order) {
  return orderState.customers.find((customer) => customer.id === order.customer_id) || null;
}

function getStatusBadgeClass(status) {
  if (status === 'cancelled') return 'status-badge--inactive';
  if (status === 'delivered' || status === 'finalized' || status === 'paid') return 'status-badge--active';
  if (status === 'pending' || status === 'awaiting_payment') return 'status-badge--warning';
  return 'status-badge--info';
}

function parseOrderFiscal(order) {
  const notes = String(order?.internal_notes || '');
  const requested = Boolean(order?.invoice_requested) || /nota fiscal solicitada:\s*sim/i.test(notes);
  const document = notes.match(/CPF\/CNPJ para NF:\s*(.*)/)?.[1]?.trim() || order?.customer_cpf || '';
  const fiscalNotes = notes.match(/Observações fiscais:\s*([\s\S]*)/)?.[1]?.trim() || '';
  return {
    requested,
    document: document === '-' ? '' : document,
    notes: fiscalNotes === '-' ? '' : fiscalNotes,
  };
}

function getFilteredOrders() {
  const customer = normalize(orderState.filters.customer);
  const number = normalize(orderState.filters.number);
  const tracking = normalize(orderState.filters.tracking);
  const cpf = normalizeDigits(orderState.filters.cpf);
  const whatsapp = normalizeDigits(orderState.filters.whatsapp);
  const email = normalize(orderState.filters.email);
  const dateFrom = orderState.filters.dateFrom ? new Date(`${orderState.filters.dateFrom}T00:00:00`) : null;
  const dateTo = orderState.filters.dateTo ? new Date(`${orderState.filters.dateTo}T23:59:59`) : null;

  return orderState.orders.filter((order) => {
    const createdAt = order.created_at ? new Date(order.created_at) : null;
    const latestTracking = getLatestTracking(order.id);
    const invoiceRequested = parseOrderFiscal(order).requested;
    const matchesCustomer = !customer || normalize(order.customer_name).includes(customer);
    const matchesCpf = !cpf || normalizeDigits(order.customer_cpf).includes(cpf);
    const matchesWhatsapp = !whatsapp || normalizeDigits(order.customer_whatsapp).includes(whatsapp);
    const matchesEmail = !email || normalize(order.customer_email).includes(email);
    const matchesNumber = !number || String(order.operation_number || '').includes(number) || normalize(order.formatted_operation_number).includes(number);
    const matchesStatus = orderState.filters.status === 'all' || order.order_status === orderState.filters.status;
    const matchesFrom = !dateFrom || (createdAt && createdAt >= dateFrom);
    const matchesTo = !dateTo || (createdAt && createdAt <= dateTo);
    const matchesTracking = !tracking || normalize(latestTracking?.tracking_code).includes(tracking);
    const matchesInvoice = orderState.filters.invoice === 'all'
      || (orderState.filters.invoice === 'yes' && invoiceRequested)
      || (orderState.filters.invoice === 'no' && !invoiceRequested);
    const matchesOrigin = orderState.filters.origin === 'all' || order.origin === orderState.filters.origin;
    const matchesPayment = orderState.filters.payment === 'all' || order.payment_status === orderState.filters.payment;
    const shippingStatus = latestTracking?.delivered_at ? 'delivered' : latestTracking?.shipped_at ? 'shipped' : 'awaiting_shipping';
    const matchesShipping = orderState.filters.shipping === 'all' || shippingStatus === orderState.filters.shipping;
    return matchesCustomer && matchesCpf && matchesWhatsapp && matchesEmail && matchesNumber && matchesStatus && matchesFrom && matchesTo && matchesTracking && matchesInvoice && matchesOrigin && matchesPayment && matchesShipping;
  });
}

function getHashParams() {
  const query = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(query);
}

function showOrdersNotice(container, message) {
  const list = container.querySelector('[data-orders-list]');
  if (!list || !message) return;
  list.insertAdjacentHTML('beforebegin', `<p class="form-message form-message--route">${escapeHtml(message)}</p>`);
}

function openRequestedOrderFromHash(container) {
  const params = getHashParams();
  const orderId = params.get('orderId') || params.get('order');
  if (!orderId) return;

  const order = orderState.orders.find((item) => item.id === orderId);
  if (!order) {
    showOrdersNotice(container, 'Pedido não encontrado ou indisponível para este perfil.');
    return;
  }

  openOrderDetails(container, order.id);
}

async function loadOrders() {
  const { data: rawOrders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (ordersError) throw ordersError;

  const orders = (rawOrders || []).map((order) => ({
    ...order,
    formatted_operation_number: String(order.operation_number || '').padStart(5, '0'),
  }));
  const orderIds = (orders || []).map((order) => order.id);
  let orderItems = [];
  let tracking = [];
  let customers = [];

  if (orderIds.length) {
    const orderItemsSource = orderState.isAdmin ? 'order_items' : 'order_items_seller_view';
    const [itemsResult, trackingResult] = await Promise.all([
      supabase
        .from(orderItemsSource)
        .select('id, order_id, product_id, variation_id, product_name, color, size, quantity, unit_price, subtotal')
        .in('order_id', orderIds),
      supabase
        .from('order_tracking')
        .select('id, order_id, tracking_code, tracking_link, carrier, shipped_at, estimated_delivery_date, delivered_at, created_at, updated_at')
        .in('order_id', orderIds),
    ]);

    if (!itemsResult.error) orderItems = itemsResult.data || [];
    if (!trackingResult.error) tracking = trackingResult.data || [];
  }

  const customerIds = [...new Set((orders || []).map((order) => order.customer_id).filter(Boolean))];
  if (customerIds.length) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, whatsapp, email, cpf, city')
      .in('id', customerIds);
    if (!error) customers = data || [];
  }

  orderState.orders = (orders || []).map((order) => {
    const customer = customers.find((item) => item.id === order.customer_id);
    return {
      ...order,
      customer_name: customer?.name || '-',
      customer_whatsapp: order.customer_whatsapp || customer?.whatsapp || null,
      customer_email: order.customer_email || customer?.email || null,
      customer_cpf: order.customer_cpf || customer?.cpf || null,
    };
  });
  orderState.orderItems = orderItems;
  orderState.tracking = tracking;
  orderState.customers = customers;
}

async function loadOrdersData(container) {
  setOrdersLoading(container);
  try {
    await loadOrders();
    renderSummaryCards(container);
    renderOrdersList(container);
    openRequestedOrderFromHash(container);
  } catch (error) {
    console.error('Erro ao carregar pedidos:', error);
    setOrdersError(container, `Não foi possível carregar pedidos: ${error.message}`);
  }
}

function renderOrdersLayoutLegacy(container, route) {
  container.innerHTML = `
    <section class="module-panel orders-module" aria-labelledby="orders-title">
      <div class="module-header">
        <div>
          <p class="eyebrow">${escapeHtml(route.label)}</p>
          <h2 id="orders-title">Pedidos Online</h2>
          <p class="module-panel__text">Acompanhe pedidos online, pagamentos, envios e entregas.</p>
          <p class="muted-text">Pedidos serão criados futuramente pelo site/checkout ou por função controlada.</p>
        </div>
        <div class="orders-header-actions">
          ${renderPeriodSegmentedControl({ id: 'orders', value: 'today' })}
          <button class="button button--secondary" type="button" data-refresh-orders>&#8635; Atualizar</button>
        </div>
      </div>

      <div class="status-grid status-grid--orders" data-orders-summary></div>

      <form class="filters-bar filters-bar--orders" data-orders-filters>
        <label class="form-field">
          <span>Busca por cliente</span>
          <input type="search" name="customer" placeholder="Pedido, cliente ou contato" autocomplete="off" />
        </label>
        <label class="form-field"><span>CPF</span><input type="search" name="cpf" placeholder="CPF/CNPJ" autocomplete="off" /></label>
        <label class="form-field"><span>WhatsApp</span><input type="search" name="whatsapp" placeholder="Telefone" autocomplete="off" /></label>
        <label class="form-field"><span>E-mail</span><input type="search" name="email" placeholder="E-mail" autocomplete="off" /></label>
        <label class="form-field">
          <span>Número do pedido</span>
          <input type="search" name="number" placeholder="00012" autocomplete="off" />
        </label>
        <label class="form-field">
          <span>Status</span>
          <select name="status">
            <option value="all">Todos</option>
            ${Object.entries(orderStatusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select>
        </label>
        <label class="form-field">
          <span>De</span>
          <input type="date" name="date_from" />
        </label>
        <label class="form-field">
          <span>Até</span>
          <input type="date" name="date_to" />
        </label>
        <label class="form-field">
          <span>Código de rastreio</span>
          <input type="search" name="tracking" placeholder="AB123..." autocomplete="off" />
        </label>
        <label class="form-field">
          <span>NF solicitada</span>
          <select name="invoice">
            <option value="all">Todas</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </select>
        </label>
        <label class="form-field">
          <span>Origem</span>
          <select name="origin">
            <option value="all">Todas</option>
            <option value="site">Site</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="manual">Manual futuro</option>
          </select>
        </label>
        <label class="form-field"><span>Pagamento</span><select name="payment"><option value="all">Todos</option><option value="pending">Pendente</option><option value="paid">Pago</option><option value="expired">Expirado</option><option value="failed">Falhou</option></select></label>
        <label class="form-field"><span>Envio</span><select name="shipping"><option value="all">Todos</option><option value="awaiting_shipping">Aguardando envio</option><option value="shipped">Enviado</option><option value="delivered">Entregue</option></select></label>
      </form>

      <div data-orders-list>
        <p class="table-empty">Carregando pedidos...</p>
      </div>
    </section>

    ${renderOrderDetailsModal()}
    ${renderTrackingModal()}
  `;
}

function renderOrdersLayout(container) {
  container.innerHTML = `
    <section class="orders-online-page" aria-labelledby="orders-title">
      <header class="orders-online-page__header">
        <div><h2 id="orders-title">Pedidos Online</h2><p>Gerencie os pedidos recebidos pelo e-commerce.</p></div>
        <div class="orders-header-actions">${renderPeriodSegmentedControl({ id: 'orders', value: 'today' })}<button class="orders-refresh-button" type="button" data-refresh-orders><span aria-hidden="true">↻</span> Atualizar</button></div>
      </header>
      <div class="orders-online-summary" data-orders-summary></div>
      <form class="orders-online-filters" data-orders-filters>
        <label class="orders-online-search"><span aria-hidden="true">⌕</span><input type="search" name="customer" placeholder="Buscar por pedido, cliente, CPF ou WhatsApp..." autocomplete="off" /></label>
        <label class="orders-online-select"><span>Status</span><select name="status"><option value="all">Todos</option>${Object.entries(orderStatusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label class="orders-online-select"><span>Pagamento</span><select name="payment"><option value="all">Todos</option><option value="pending">Pendente</option><option value="paid">Pago</option><option value="expired">Expirado</option><option value="failed">Falhou</option></select></label>
        <label class="orders-online-select"><span>Envio</span><select name="shipping"><option value="all">Todos</option><option value="awaiting_shipping">Aguardando envio</option><option value="shipped">Enviado</option><option value="delivered">Entregue</option></select></label>
        <label class="orders-online-select"><span>Origem</span><select name="origin"><option value="all">Todas</option><option value="site">Site Veste Bem</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="manual">Outros</option></select></label>
        <button class="orders-filter-button" type="button" data-clear-orders-filters><span aria-hidden="true">⌁</span> Filtros</button>
        <input type="hidden" name="number" /><input type="hidden" name="date_from" /><input type="hidden" name="date_to" /><input type="hidden" name="tracking" /><input type="hidden" name="invoice" value="all" /><input type="hidden" name="cpf" /><input type="hidden" name="whatsapp" /><input type="hidden" name="email" />
      </form>
      <div class="orders-online-list" data-orders-list><p class="table-empty">Carregando pedidos...</p></div>
    </section>
    ${renderOrderDetailsModal()}${renderTrackingModal()}`;
}

function renderOrderDetailsModal() {
  return `
    <div class="modal-backdrop" data-order-details-modal hidden>
      <section class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="order-details-title">
        <div class="modal__content">
          <div class="modal__header">
            <div>
              <p class="eyebrow">Pedido</p>
              <h3 id="order-details-title">Detalhes do pedido</h3>
            </div>
            <button class="icon-button" type="button" data-close-order-details-modal aria-label="Fechar">×</button>
          </div>
          <div data-order-details></div>
          <p class="form-message" data-order-message></p>
          <div class="modal__actions order-actions" data-order-actions></div>
        </div>
      </section>
    </div>
  `;
}

function renderTrackingModal() {
  return `
    <div class="modal-backdrop" data-order-tracking-modal hidden>
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="order-tracking-title">
        <form data-order-tracking-form>
          <div class="modal__header">
            <div>
              <p class="eyebrow">Rastreio</p>
              <h3 id="order-tracking-title">Informar rastreio</h3>
            </div>
            <button class="icon-button" type="button" data-close-order-tracking-modal aria-label="Fechar">×</button>
          </div>
          <div class="form-grid">
            <label class="form-field">
              <span>Transportadora</span>
              <input name="carrier" type="text" />
            </label>
            <label class="form-field">
              <span>Código de rastreio</span>
              <input name="tracking_code" type="text" />
            </label>
            <label class="form-field form-field--full">
              <span>Link de rastreio</span>
              <input name="tracking_link" type="url" />
            </label>
            <label class="form-field">
              <span>Data de envio</span>
              <input name="shipped_at" type="datetime-local" />
            </label>
            <label class="form-field">
              <span>Previsão de entrega</span>
              <input name="estimated_delivery_date" type="date" />
            </label>
          </div>
          <p class="muted-text">Ação operacional temporária até integração com transportadora/Melhor Envio.</p>
          <p class="form-message" data-order-tracking-message></p>
          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-close-order-tracking-modal>Cancelar</button>
            <button class="button button--primary" type="submit">Salvar rastreio</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function setOrdersLoading(container) {
  const list = container.querySelector('[data-orders-list]');
  if (list) list.innerHTML = '<p class="table-empty">Carregando pedidos...</p>';
}

function setOrdersError(container, message) {
  const list = container.querySelector('[data-orders-list]');
  if (list) list.innerHTML = `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function renderOrdersListLegacy(container) {
  const target = container.querySelector('[data-orders-list]');
  if (!target) return;
  const orders = getFilteredOrders();
  if (!orders.length) {
    target.innerHTML = '<p class="table-empty">Nenhum pedido encontrado.</p>';
    return;
  }
  const pages = Math.max(1, Math.ceil(orders.length / orderState.pageSize));
  orderState.page = Math.min(orderState.page, pages);
  const visible = orders.slice((orderState.page - 1) * orderState.pageSize, orderState.page * orderState.pageSize);
  target.innerHTML = `<div class="table-shell"><table class="data-table orders-table orders-online-table"><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Envio</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>${visible.map(renderOrderRow).join('')}</tbody></table></div><div class="orders-list-footer"><span>Mostrando ${(orderState.page - 1) * orderState.pageSize + 1} a ${Math.min(orderState.page * orderState.pageSize, orders.length)} de ${orders.length} pedidos</span><div><button class="button button--compact button--secondary" data-orders-page="prev" ${orderState.page === 1 ? 'disabled' : ''}>‹</button><strong>${orderState.page}</strong><button class="button button--compact button--secondary" data-orders-page="next" ${orderState.page === pages ? 'disabled' : ''}>›</button></div></div>`;
}

function renderOrderRowLegacy(order) {
  const latestTracking = getLatestTracking(order.id);
  const itemCount = getOrderItems(order.id).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const shipping = latestTracking?.delivered_at ? 'Entregue' : latestTracking?.shipped_at ? 'Enviado' : 'Aguardando envio';
  return `<tr><td data-label="Pedido"><strong>${escapeHtml(formatOrderOperationNumber(order))}</strong></td><td data-label="Data">${escapeHtml(formatDate(order.created_at))}</td><td data-label="Cliente">${escapeHtml(order.customer_name || '-')}</td><td data-label="Itens">${itemCount || '-'} ${itemCount === 1 ? 'peça' : 'peças'}</td><td data-label="Pagamento">${escapeHtml(paymentLabels[order.payment_method] || 'Pix')} · ${escapeHtml(paymentStatusLabels[order.payment_status] || 'Pendente')}</td><td data-label="Envio">${shipping}</td><td data-label="Valor"><strong>${currency(order.total)}</strong></td><td data-label="Status"><span class="status-badge ${getStatusBadgeClass(order.order_status)}">${escapeHtml(orderStatusLabels[order.order_status] || order.order_status)}</span></td><td data-label="Ações"><button class="icon-button" type="button" data-view-order="${order.id}" aria-label="Visualizar pedido">&#8942;</button></td></tr>`;
}

function renderSummaryCardsLegacy(container) {
  const target = container.querySelector('[data-orders-summary]');
  if (!target) return;

  const summaries = [
    ['awaiting_payment', 'Aguardando pagamento'],
    ['paid', 'Pagos'],
    ['in_separation', 'Em separação'],
    ['awaiting_shipping', 'Aguardando envio'],
    ['shipped', 'Enviados'],
    ['delivered', 'Entregues'],
    ['cancelled', 'Cancelados'],
  ];

  target.innerHTML = summaries.map(([status, label]) => {
    const count = orderState.orders.filter((order) => order.order_status === status).length;
    return `
      <article class="status-card">
        <span>${escapeHtml(label)}</span>
        <strong>${count}</strong>
      </article>
    `;
  }).join('');
}

function renderOrdersList(container) {
  const target = container.querySelector('[data-orders-list]');
  if (!target) return;

  const orders = getFilteredOrders();
  if (!orders.length) {
    target.innerHTML = '<p class="table-empty">Nenhum pedido encontrado.</p>';
    return;
  }

  target.innerHTML = `
    <div class="table-shell">
      <table class="data-table orders-table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Data</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Pedido</th>
            <th>Pagamento</th>
            <th>Envio</th>
            <th>Rastreio</th>
            <th>NF</th>
            <th>Origem</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${orders.map(renderOrderRow).join('')}</tbody>
      </table>
    </div>
  `;
}

function renderOrderRow(order) {
  const latestTracking = getLatestTracking(order.id);
  return `
    <tr>
      <td data-label="Número"><strong>${escapeHtml(formatOrderOperationNumber(order))}</strong></td>
      <td data-label="Data">${escapeHtml(formatDate(order.created_at))}</td>
      <td data-label="Cliente">${escapeHtml(order.customer_name || '-')}</td>
      <td data-label="Total"><strong>${currency(order.total)}</strong></td>
      <td data-label="Pedido"><span class="status-badge ${getStatusBadgeClass(order.order_status)}">${escapeHtml(orderStatusLabels[order.order_status] || order.order_status)}</span></td>
      <td data-label="Pagamento"><span class="status-badge ${getStatusBadgeClass(order.payment_status)}">${escapeHtml(paymentStatusLabels[order.payment_status] || order.payment_status)}</span></td>
      <td data-label="Envio">${escapeHtml(order.shipping_method || order.carrier || '-')}</td>
      <td data-label="Rastreio">${escapeHtml(latestTracking?.tracking_code || '-')}</td>
      <td data-label="NF">${parseOrderFiscal(order).requested ? '<span class="status-badge status-badge--invoice">NF Solicitada</span>' : '-'}</td>
      <td data-label="Origem">${escapeHtml(originLabels[order.origin] || order.origin || '-')}</td>
      <td data-label="Ações">
        <button class="button button--compact button--secondary" type="button" data-view-order="${order.id}">Visualizar</button>
      </td>
    </tr>
  `;
}

function renderSummaryCardsLegacyV2(container) {
  const target = container.querySelector('[data-orders-summary]');
  if (!target) return;
  const orders = getFilteredOrders();
  const paidStatuses = ['paid', 'in_separation', 'awaiting_shipping', 'shipped', 'delivered', 'finalized'];
  const cards = [
    ['Pedidos pendentes', orders.filter((order) => ['paid', 'in_separation', 'awaiting_shipping'].includes(order.order_status)).length, 'Requerem sua ação'],
    ['Aguardando envio', orders.filter((order) => ['in_separation', 'awaiting_shipping'].includes(order.order_status)).length, 'Pedidos prontos para envio'],
    ['Enviados', orders.filter((order) => ['shipped', 'delivered', 'finalized'].includes(order.order_status)).length, 'Pedidos despachados'],
    ['Faturamento online', currency(orders.filter((order) => paidStatuses.includes(order.order_status) && order.payment_status !== 'pending').reduce((sum, order) => sum + Number(order.total || 0), 0)), 'Período selecionado'],
  ];
  target.innerHTML = cards.map(([label, value, helper]) => `<article class="status-card orders-online-card"><span class="orders-online-card__icon">${label === 'Faturamento online' ? 'R$' : '◌'}</span><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(helper)}</small></div></article>`).join('');
}

function renderSummaryCards(container) {
  const target = container.querySelector('[data-orders-summary]');
  if (!target) return;
  const orders = getFilteredOrders();
  const paidStatuses = ['paid', 'in_separation', 'awaiting_shipping', 'shipped', 'delivered', 'finalized'];
  const cards = [
    ['Pedidos pendentes', orders.filter((order) => ['paid', 'in_separation', 'awaiting_shipping'].includes(order.order_status)).length, 'Requerem sua ação', 'receipt'],
    ['Aguardando envio', orders.filter((order) => ['in_separation', 'awaiting_shipping'].includes(order.order_status)).length, 'Pedidos prontos para envio', 'truck'],
    ['Enviados', orders.filter((order) => ['shipped', 'delivered', 'finalized'].includes(order.order_status)).length, 'Pedidos despachados', 'package'],
    ['Faturamento online', currency(orders.filter((order) => paidStatuses.includes(order.order_status) && order.payment_status !== 'pending').reduce((sum, order) => sum + Number(order.total || 0), 0)), 'Período selecionado', 'wallet'],
  ];
  target.innerHTML = cards.map(([label, value, helper, icon]) => `<article class="status-card orders-online-card"><span class="orders-online-card__icon">${orderIcon(icon)}</span><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(helper)}</small></div></article>`).join('');
}

function renderOrderDetails(container, order) {
  const customer = getOrderCustomer(order);
  const items = getOrderItems(order.id);
  const trackingRows = getOrderTracking(order.id);
  const latestTracking = trackingRows[0];
  const fiscal = parseOrderFiscal(order);
  const address = [
    order.street,
    order.number,
    order.complement,
    order.neighborhood,
    order.city,
    order.state,
    order.postal_code,
  ].filter(Boolean).join(', ');

  const details = container.querySelector('[data-order-details]');
  details.innerHTML = `
    <div class="order-detail-section">
      <h4>Dados principais</h4>
      <div class="sale-details-grid">
        <div><span>Número</span><strong>${escapeHtml(formatOrderOperationNumber(order))}</strong></div>
        <div><span>Data</span><strong>${escapeHtml(formatDate(order.created_at))}</strong></div>
        <div><span>Origem</span><strong>${escapeHtml(originLabels[order.origin] || order.origin || '-')}</strong></div>
        <div><span>Status atual</span><strong>${escapeHtml(orderStatusLabels[order.order_status] || order.order_status)}</strong></div>
        <div><span>Total</span><strong>${currency(order.total)}</strong></div>
        <div><span>Desconto</span><strong>${currency(order.discount)}</strong></div>
      </div>
    </div>

    ${order.order_status === 'awaiting_payment' ? `<div class="order-detail-section order-reservation"><h4>Reserva de estoque</h4><div class="sale-details-grid"><div><span>Status</span><strong>Reservado</strong></div><div><span>Expira em</span><strong>${escapeHtml(formatDate(order.stock_reservation_expires_at || order.payment_expires_at))}</strong></div><div><span>Tempo restante</span><strong>${order.stock_reservation_expires_at ? escapeHtml(formatReservationRemaining(order.stock_reservation_expires_at)) : '24 horas após a criação'}</strong></div></div></div>` : ''}

    <div class="order-detail-section">
      <h4>Cliente</h4>
      <div class="sale-details-grid">
        <div><span>Nome</span><strong>${escapeHtml(order.customer_name || customer?.name || '-')}</strong></div>
        <div><span>WhatsApp</span><strong>${escapeHtml(order.customer_whatsapp || customer?.whatsapp || '-')}</strong></div>
        <div><span>E-mail</span><strong>${escapeHtml(order.customer_email || customer?.email || '-')}</strong></div>
        <div><span>CPF/CNPJ</span><strong>${escapeHtml(order.customer_cpf || customer?.cpf || '-')}</strong></div>
      </div>
    </div>

    <div class="order-detail-section">
      <h4>Itens</h4>
      ${items.length ? `
        <div class="sale-cart-list">
          ${items.map((item) => `
            <article class="sale-cart-item">
              <div>
                <strong>${escapeHtml(item.product_name)}</strong>
                <span>Cor: ${escapeHtml(item.color)} | Tamanho: ${escapeHtml(item.size)} | Qtd: ${item.quantity}</span>
              </div>
              <div>
                <span>${currency(item.unit_price)}</span>
                <strong>${currency(item.subtotal)}</strong>
              </div>
            </article>
          `).join('')}
        </div>
      ` : '<p class="table-empty">Itens não disponíveis.</p>'}
    </div>

    <div class="order-detail-section">
      <h4>Pagamento</h4>
      <div class="sale-details-grid">
        <div><span>Forma</span><strong>${escapeHtml(paymentLabels[order.payment_method] || order.payment_method || '-')}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(paymentStatusLabels[order.payment_status] || order.payment_status)}</strong></div>
        <div><span>Confirmado em</span><strong>${escapeHtml(formatDate(order.paid_at))}</strong></div>
        <div><span>Origem da confirmação</span><strong>${order.paid_at ? 'manual/gateway futuro' : '-'}</strong></div>
      </div>
    </div>

    <div class="order-detail-section">
      <h4>Envio</h4>
      <div class="sale-details-grid">
        <div><span>Endereço</span><strong>${escapeHtml(address || '-')}</strong></div>
        <div><span>Transportadora</span><strong>${escapeHtml(latestTracking?.carrier || order.carrier || '-')}</strong></div>
        <div><span>Código</span><strong>${escapeHtml(latestTracking?.tracking_code || '-')}</strong></div>
        <div><span>Link</span><strong>${latestTracking?.tracking_link ? `<a href="${escapeHtml(latestTracking.tracking_link)}" target="_blank" rel="noopener noreferrer">Abrir rastreio</a>` : '-'}</strong></div>
        <div><span>Status do envio</span><strong>${escapeHtml(orderStatusLabels[order.order_status] || order.order_status)}</strong></div>
      </div>
    </div>

    <div class="order-detail-section">
      <h4>Fiscal</h4>
      <div class="sale-details-grid">
        <div><span>NF solicitada</span><strong>${fiscal.requested ? 'Sim' : 'Não'}</strong></div>
        <div><span>CPF/CNPJ para NF</span><strong>${escapeHtml(fiscal.document || customer?.cpf || '-')}</strong></div>
        <div><span>Observações fiscais</span><strong>${escapeHtml(fiscal.notes || '-')}</strong></div>
      </div>
    </div>

    <div class="order-detail-section">
      <h4>Observações</h4>
      <p class="muted-text">${escapeHtml(order.internal_notes || '-')}</p>
    </div>

    <div class="order-detail-section">
      <h4>Timeline</h4>
      ${renderTimeline(order, trackingRows)}
    </div>
  `;

  renderOrderActions(container, order);
}

function renderTimeline(order, trackingRows) {
  const currentIndex = timelineSteps.findIndex(([status]) => status === order.order_status);
  const cancelled = order.order_status === 'cancelled';
  const orderNumber = formatOrderOperationNumber(order);
  return `
    <div class="order-timeline">
      ${timelineSteps.map(([status, label], index) => {
        const isDone = cancelled ? status === 'cancelled' : index <= currentIndex && status !== 'cancelled';
        const stepLabel = status === 'awaiting_payment'
          ? `Pedido ${orderNumber} criado`
          : status === 'shipped'
            ? `Pedido ${orderNumber} enviado`
            : label;
        return `
          <div class="order-timeline__step ${isDone ? 'is-done' : ''}">
            <span></span>
            <strong>${escapeHtml(stepLabel)}</strong>
          </div>
        `;
      }).join('')}
    </div>
    ${trackingRows.length ? `
      <div class="sale-history-list">
        ${trackingRows.map((row) => `
          <article class="sale-history-item">
            <strong>${escapeHtml(row.tracking_code || 'Rastreio atualizado')}</strong>
            <span>${escapeHtml(row.carrier || '-')}</span>
            <span>${escapeHtml(formatDate(row.updated_at || row.created_at))}</span>
            ${row.tracking_link ? `<span><a href="${escapeHtml(row.tracking_link)}" target="_blank" rel="noopener noreferrer">Link de rastreio</a></span>` : ''}
          </article>
        `).join('')}
      </div>
    ` : '<p class="table-empty">Histórico de rastreio será exibido quando houver integração ou atualização manual.</p>'}
  `;
}

function renderOrderActions(container, order) {
  const actions = container.querySelector('[data-order-actions]');
  const buttons = [];

  buttons.push('<button class="button button--secondary" type="button" data-send-order-whatsapp>Enviar atualização pelo WhatsApp</button>');

  if (order.order_status === 'cancelled' || order.order_status === 'finalized') {
    buttons.push('<button class="button button--primary" type="button" data-close-order-details-modal>Fechar</button>');
    actions.innerHTML = buttons.join('');
    return;
  }

  if (order.order_status === 'awaiting_payment' && orderState.isAdmin) {
    buttons.push('<button class="button button--primary" type="button" data-order-action="mark_paid">Marcar como pago</button>');
  }

  if (order.order_status === 'paid') {
    buttons.push('<button class="button button--primary" type="button" data-order-action="in_separation">Enviar para separação</button>');
  }

  if (order.order_status === 'in_separation') {
    buttons.push('<button class="button button--primary" type="button" data-order-action="awaiting_shipping">Marcar como aguardando envio</button>');
  }

  if (order.order_status === 'awaiting_shipping') {
    buttons.push('<button class="button button--secondary" type="button" data-open-order-tracking>Informar rastreio</button>');
    buttons.push('<button class="button button--primary" type="button" data-order-action="shipped">Marcar como enviado</button>');
  }

  if (order.order_status === 'shipped') {
    buttons.push('<button class="button button--secondary" type="button" data-open-order-tracking>Atualizar rastreio</button>');
    buttons.push('<button class="button button--primary" type="button" data-order-action="delivered">Marcar como entregue</button>');
  }

  if (order.order_status === 'delivered' && orderState.isAdmin) {
    buttons.push('<button class="button button--secondary" type="button" data-order-action="finalize_delivered">Finalizar entregues elegíveis</button>');
  }

  if ((order.order_status === 'awaiting_payment' || order.order_status === 'paid') && orderState.isAdmin) {
    buttons.push('<button class="button button--danger" type="button" data-order-action="cancel">Cancelar pedido</button>');
  }

  buttons.push('<button class="button button--secondary" type="button" data-close-order-details-modal>Fechar</button>');
  actions.innerHTML = buttons.join('');
}

function openOrderDetails(container, orderId) {
  const order = orderState.orders.find((item) => item.id === orderId);
  if (!order) return;
  orderState.viewingOrder = order;
  const message = container.querySelector('[data-order-message]');
  message.textContent = '';
  renderOrderDetails(container, order);
  container.querySelector('[data-order-details-modal]').hidden = false;
}

function closeOrderDetails(container) {
  container.querySelector('[data-order-details-modal]').hidden = true;
  orderState.viewingOrder = null;
}

function openTrackingModal(container) {
  const order = orderState.viewingOrder;
  if (!order) return;
  const form = container.querySelector('[data-order-tracking-form]');
  const message = container.querySelector('[data-order-tracking-message]');
  const latest = getLatestTracking(order.id);

  orderState.trackingOrder = order;
  form.reset();
  form.elements.carrier.value = latest?.carrier || order.carrier || '';
  form.elements.tracking_code.value = latest?.tracking_code || '';
  form.elements.tracking_link.value = latest?.tracking_link || '';
  form.elements.shipped_at.value = latest?.shipped_at ? new Date(latest.shipped_at).toISOString().slice(0, 16) : '';
  form.elements.estimated_delivery_date.value = formatDateOnly(latest?.estimated_delivery_date);
  message.textContent = '';
  container.querySelector('[data-order-tracking-modal]').hidden = false;
}

function closeTrackingModal(container) {
  container.querySelector('[data-order-tracking-modal]').hidden = true;
  orderState.trackingOrder = null;
}

async function submitTracking(container, event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = container.querySelector('[data-order-tracking-message]');

  if (!orderState.trackingOrder) return;
  message.textContent = 'Salvando rastreio...';

  const { error } = await supabase.rpc('update_order_tracking', {
    p_order_id: orderState.trackingOrder.id,
    p_tracking_code: form.elements.tracking_code.value.trim() || null,
    p_tracking_link: form.elements.tracking_link.value.trim() || null,
    p_carrier: form.elements.carrier.value.trim() || null,
    p_shipped_at: form.elements.shipped_at.value ? new Date(form.elements.shipped_at.value).toISOString() : null,
    p_estimated_delivery_date: form.elements.estimated_delivery_date.value || null,
  });

  if (error) {
    console.error('Erro ao salvar rastreio:', error);
    message.textContent = `Erro ao salvar rastreio: ${error.message}`;
    return;
  }

  closeTrackingModal(container);
  await loadOrdersData(container);
  const currentOrder = orderState.orders.find((order) => order.id === orderState.viewingOrder?.id);
  if (currentOrder) {
    orderState.viewingOrder = currentOrder;
    renderOrderDetails(container, currentOrder);
  }
}

async function runOrderAction(container, action) {
  const order = orderState.viewingOrder;
  const message = container.querySelector('[data-order-message]');
  if (!order) return;

  const adminOnlyActions = ['mark_paid', 'cancel', 'finalize_delivered'];
  if (adminOnlyActions.includes(action) && !orderState.isAdmin) {
    message.textContent = 'Ação disponível apenas para administradores.';
    return;
  }

  message.textContent = 'Executando ação...';

  let result;
  if (action === 'mark_paid') {
    result = await supabase.rpc('mark_order_paid', { p_order_id: order.id });
  } else if (action === 'cancel') {
    result = await supabase.rpc('cancel_order', { p_order_id: order.id });
  } else if (action === 'finalize_delivered') {
    result = await supabase.rpc('finalize_delivered_orders');
  } else {
    result = await supabase.rpc('update_order_status', {
      p_order_id: order.id,
      p_order_status: action,
    });
  }

  if (result.error) {
    console.error('Erro ao executar ação do pedido:', result.error);
    message.textContent = `Erro ao executar ação: ${result.error.message}`;
    return;
  }

  await loadOrdersData(container);
  const updatedOrder = orderState.orders.find((item) => item.id === order.id);
  if (updatedOrder) {
    orderState.viewingOrder = updatedOrder;
    renderOrderDetails(container, updatedOrder);
  } else {
    closeOrderDetails(container);
  }
}

function buildOrderWhatsAppMessage(order) {
  const latestTracking = getLatestTracking(order.id);
  const customerName = order.customer_name || 'cliente';
  const number = formatOrderOperationNumber(order);

  if (order.order_status === 'awaiting_payment') {
    return `Olá, ${customerName}.\n\nRecebemos seu pedido ${number} na Veste Bem.\n\nAssim que o pagamento for confirmado, iniciaremos a separação.\n\nVeste Bem`;
  }

  if (order.order_status === 'in_separation' || order.order_status === 'paid') {
    return `Olá, ${customerName}.\n\nSeu pedido ${number} está em separação.\n\nAssim que for enviado, enviaremos o código de rastreio.\n\nVeste Bem`;
  }

  if (order.order_status === 'shipped') {
    return `Olá, ${customerName}.\n\nSeu pedido ${number} foi enviado.\n\nCódigo de rastreio:\n${latestTracking?.tracking_code || '-'}\n\nLink:\n${latestTracking?.tracking_link || '-'}\n\nVeste Bem`;
  }

  return `Olá, ${customerName}.\n\nAtualização do pedido ${number}: ${orderStatusLabels[order.order_status] || order.order_status}.\n\nVeste Bem`;
}

function sendOrderWhatsApp(container) {
  const order = orderState.viewingOrder;
  const customer = order ? getOrderCustomer(order) : null;
  const phone = order?.customer_whatsapp || customer?.whatsapp;
  const message = container.querySelector('[data-order-message]');
  const digits = normalizeDigits(phone);

  if (!digits) {
    message.textContent = 'Este cliente não possui WhatsApp cadastrado.';
    return;
  }

  const normalizedPhone = digits.length <= 11 ? `55${digits}` : digits;
  window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(buildOrderWhatsAppMessage(order))}`, '_blank', 'noopener,noreferrer');
}

function syncFilters(container) {
  const filters = container.querySelector('[data-orders-filters]');
  orderState.filters.customer = filters.elements.customer.value;
  orderState.filters.cpf = filters.elements.cpf?.value || '';
  orderState.filters.whatsapp = filters.elements.whatsapp?.value || '';
  orderState.filters.email = filters.elements.email?.value || '';
  orderState.filters.number = filters.elements.number.value;
  orderState.filters.status = filters.elements.status.value;
  orderState.filters.dateFrom = filters.elements.date_from.value;
  orderState.filters.dateTo = filters.elements.date_to.value;
  orderState.filters.tracking = filters.elements.tracking.value;
  orderState.filters.invoice = filters.elements.invoice.value;
  orderState.filters.origin = filters.elements.origin.value;
  orderState.filters.payment = filters.elements.payment?.value || 'all';
  orderState.filters.shipping = filters.elements.shipping?.value || 'all';
  orderState.page = 1;
  renderSummaryCards(container);
  renderOrdersList(container);
}

function bindOrdersEvents(container) {
  const signal = orderState.abortController.signal;
  const filters = container.querySelector('[data-orders-filters]');

  filters.addEventListener('input', () => syncFilters(container), { signal });
  filters.addEventListener('change', () => syncFilters(container), { signal });
  bindPeriodSegmentedControl(container, { id: 'orders', value: 'today', onChange: async (range) => {
    filters.elements.date_from.value = range.dateFrom;
    filters.elements.date_to.value = range.dateTo;
    syncFilters(container);
  } });

  const today = getPeriodRange('today');
  filters.elements.date_from.value = today.dateFrom;
  filters.elements.date_to.value = today.dateTo;
  orderState.filters.dateFrom = today.dateFrom;
  orderState.filters.dateTo = today.dateTo;

  container.querySelector('[data-refresh-orders]')?.addEventListener('click', () => loadOrdersData(container), { signal });
  container.querySelector('[data-clear-orders-filters]')?.addEventListener('click', () => {
    filters.reset();
    filters.elements.date_from.value = today.dateFrom;
    filters.elements.date_to.value = today.dateTo;
    syncFilters(container);
  }, { signal });

  container.querySelector('[data-order-tracking-form]')?.addEventListener('submit', (event) => submitTracking(container, event), { signal });

  container.querySelectorAll('[data-close-order-details-modal]').forEach((button) => {
    button.addEventListener('click', () => closeOrderDetails(container), { signal });
  });

  container.querySelectorAll('[data-close-order-tracking-modal]').forEach((button) => {
    button.addEventListener('click', () => closeTrackingModal(container), { signal });
  });

  container.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view-order]');
    const actionButton = event.target.closest('[data-order-action]');
    const trackingButton = event.target.closest('[data-open-order-tracking]');
    const whatsappButton = event.target.closest('[data-send-order-whatsapp]');
    const pageButton = event.target.closest('[data-orders-page]');

    if (pageButton) {
      orderState.page += pageButton.dataset.ordersPage === 'next' ? 1 : -1;
      renderOrdersList(container);
      return;
    }

    if (viewButton) {
      openOrderDetails(container, viewButton.dataset.viewOrder);
      return;
    }

    if (trackingButton) {
      openTrackingModal(container);
      return;
    }

    if (actionButton) {
      runOrderAction(container, actionButton.dataset.orderAction);
      return;
    }

    if (whatsappButton) {
      sendOrderWhatsApp(container);
    }
  }, { signal });
}

export function renderOrders(container, route, { profile }) {
  orderState.abortController?.abort();
  orderState.abortController = new AbortController();
  orderState.profile = profile;
  orderState.isAdmin = isAdmin(profile);
  orderState.orders = [];
  orderState.orderItems = [];
  orderState.tracking = [];
  orderState.customers = [];
  orderState.viewingOrder = null;
  orderState.trackingOrder = null;
  orderState.page = 1;
  orderState.filters = {
    customer: '',
    cpf: '',
    whatsapp: '',
    email: '',
    number: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    tracking: '',
    invoice: 'all',
    origin: 'all',
    payment: 'all',
    shipping: 'all',
  };

  renderOrdersLayout(container, route);
  bindOrdersEvents(container);
  loadOrdersData(container);
}
