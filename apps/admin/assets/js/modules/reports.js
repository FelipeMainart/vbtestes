import { supabase } from '../supabaseClient.js';
import { bindPeriodSegmentedControl, getPeriodRange, renderPeriodSegmentedControl } from '../period.js';
import { isAdmin } from '../permissions.js';

const reportState = {
  profile: null,
  isAdmin: false,
  activeTab: 'sales',
  cache: {},
  filters: {},
  abortController: null,
  level: 'home',
  category: null,
  reportKey: null,
  period: 'today',
  eventsBound: false,
  recentReports: [],
  favorites: new Set(),
};

const reportTabs = [
  { id: 'sales', label: 'Vendas' },
  { id: 'products', label: 'Produtos' },
  { id: 'customers', label: 'Clientes' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'finance', label: 'Financeiro', adminOnly: true },
  { id: 'stock', label: 'Estoque' },
];

const paymentLabels = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  bank_transfer: 'Transferência',
  other: 'Outro',
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

const financeTypeLabels = {
  income: 'Receita',
  expense: 'Despesa',
  reversal: 'Estorno',
};

const financeCategoryLabels = {
  sale_income: 'Venda Física',
  order_income: 'Pedido Online',
  income: 'Receita',
  expense: 'Despesa',
  manual_expense: 'Despesa Manual',
  marketing: 'Marketing',
  mercadoria: 'Mercadoria',
  frete: 'Frete',
  impostos: 'Impostos',
  outros: 'Outros',
};

const financeOriginLabels = {
  sale: 'Venda Física',
  order: 'Pedido Online',
  expense: 'Despesa',
};

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

function formatDate(value) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
  }
  return new Date(value).toLocaleDateString('pt-BR');
}

function dateKey(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function monthStartKey() {
  const date = new Date();
  date.setDate(1);
  return dateKey(date);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function parseNumber(value) {
  return Number(value || 0);
}

function formatSaleNumber(sale) {
  const number = sale?.formatted_operation_number || String(sale?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `VD-${number}` : 'VD-00000';
}

function formatOrderNumber(order) {
  const number = order?.formatted_operation_number || String(order?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `PD-${number}` : 'PD-00000';
}

function getCurrentFilters(tab) {
  return reportState.filters[tab] || {};
}

function setCurrentFilters(tab, filters) {
  reportState.filters[tab] = filters;
}

function inPeriod(value, filters) {
  const key = dateKey(value);
  if (!key) return false;
  return (!filters.dateFrom || key >= filters.dateFrom) && (!filters.dateTo || key <= filters.dateTo);
}

function inPeriodByKey(key, filters) {
  return Boolean(key) && (!filters.dateFrom || key >= filters.dateFrom) && (!filters.dateTo || key <= filters.dateTo);
}

function sum(items, field) {
  return items.reduce((total, item) => total + parseNumber(item[field]), 0);
}

function average(total, count) {
  return count ? total / count : 0;
}

function renderLoading() {
  return '<p class="table-empty">Carregando relatório...</p>';
}

function renderEmpty(message = 'Nenhum registro encontrado.') {
  return `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function renderMetricCards(cards) {
  return `
    <div class="status-grid reports-summary-grid">
      ${cards.map((card) => `
        <article class="status-card reports-summary-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>
      `).join('')}
    </div>
  `;
}

function renderBarChart(rows, formatter = (value) => value) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return `
    <article class="reports-card">
      <div class="reports-card__header">
        <h3>${escapeHtml(rows.title || 'Gráfico')}</h3>
      </div>
      <div class="reports-chart" role="img" aria-label="${escapeHtml(rows.title || 'Gráfico')}">
        ${rows.map((row) => {
          const height = Math.max(4, Math.round((row.value / max) * 100));
          return `
            <div class="reports-chart__bar" title="${escapeHtml(`${row.label}: ${formatter(row.value)}`)}">
              <span style="height: ${height}%"></span>
            </div>
          `;
        }).join('')}
      </div>
    </article>
  `;
}

function renderStatusChart(rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return `
    <article class="reports-card">
      <div class="reports-card__header">
        <h3>Pedidos por status</h3>
      </div>
      <div class="reports-status-chart">
        ${rows.map((row) => `
          <div>
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
            <small><i style="width: ${Math.max(4, Math.round((row.value / max) * 100))}%"></i></small>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

function buildDailyRows(items, field = null) {
  const map = new Map();
  items.forEach((item) => {
    const key = dateKey(item.created_at);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + (field ? parseNumber(item[field]) : 1));
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      label: new Date(`${key}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value,
    }));
}

async function safeQuery(query, fallback = []) {
  const { data, error } = await query;
  if (error) {
    console.warn('Consulta de relatório indisponível:', error.message);
    return fallback;
  }
  return data || fallback;
}

async function loadSaleItemsForReport(saleIds) {
  if (!saleIds.length) return { saleItems: [], saleItemsAvailable: true };
  const { data, error } = await supabase
    .from('sale_items')
    .select('id, sale_id, product_id, variation_id, product_name, quantity, subtotal')
    .in('sale_id', saleIds);

  if (error) {
    console.warn('Itens de venda não disponíveis para relatórios:', error.message);
    return { saleItems: [], saleItemsAvailable: false };
  }

  return { saleItems: data || [], saleItemsAvailable: true };
}

async function loadSalesReport() {
  if (reportState.cache.sales) return reportState.cache.sales;
  const sales = await safeQuery(
    supabase
      .from('vw_sales_seller')
      .select('id, operation_number, formatted_operation_number, customer_id, customer_name, payment_method, net_total, status, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(1500),
  );
  const saleIds = sales.map((sale) => sale.id);
  const { saleItems, saleItemsAvailable } = await loadSaleItemsForReport(saleIds);
  const sellerIds = [...new Set(sales.map((sale) => sale.created_by).filter(Boolean))];
  const sellers = sellerIds.length
    ? await safeQuery(supabase.from('profiles').select('id, name, email').in('id', sellerIds))
    : [];

  reportState.cache.sales = { sales, saleItems, saleItemsAvailable, sellers };
  return reportState.cache.sales;
}

async function loadOrdersReport() {
  if (reportState.cache.orders) return reportState.cache.orders;
  const orders = await safeQuery(
    supabase
      .from('orders')
      .select('id, operation_number, customer_id, payment_status, order_status, total, created_at')
      .order('created_at', { ascending: false })
      .limit(1500),
  );
  const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))];
  const customers = customerIds.length
    ? await safeQuery(supabase.from('customers').select('id, name, city').in('id', customerIds))
    : [];
  const normalizedOrders = orders.map((order) => ({
    ...order,
    formatted_operation_number: String(order.operation_number || '').padStart(5, '0'),
    customer_name: customers.find((customer) => customer.id === order.customer_id)?.name || '-',
  }));

  reportState.cache.orders = { orders: normalizedOrders, customers };
  return reportState.cache.orders;
}

async function loadStockReport() {
  if (reportState.cache.stock) return reportState.cache.stock;
  const stockRows = await safeQuery(
    supabase
      .from('vw_stock_seller')
      .select('variation_id, product_id, product_name, color_name, size, quantity, minimum_stock, stock_status')
      .order('quantity', { ascending: true }),
  );
  const salesData = await loadSalesReport();
  reportState.cache.stock = { stockRows, sales: salesData.sales, saleItems: salesData.saleItems, saleItemsAvailable: salesData.saleItemsAvailable };
  return reportState.cache.stock;
}

async function loadFinanceReport() {
  if (reportState.cache.finance) return reportState.cache.finance;
  const [entries, expenses, suppliers] = await Promise.all([
    safeQuery(supabase.from('financial_entries').select('id, type, category, description, amount, status, reference_type, reference_id, created_at').order('created_at', { ascending: false }).limit(2000)),
    safeQuery(supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(2000)),
    safeQuery(supabase.from('suppliers').select('id, name')),
  ]);
  reportState.cache.finance = { entries, expenses, suppliers };
  return reportState.cache.finance;
}

function getFilteredSales(data) {
  const filters = getCurrentFilters('sales');
  return getSalesByPeriod(data, 'sales').filter((sale) => {
    const matchesPeriod = inPeriod(sale.created_at, filters);
    const matchesSeller = !filters.seller || sale.created_by === filters.seller;
    const matchesPayment = !filters.payment || sale.payment_method === filters.payment;
    const matchesCustomer = !filters.customer || normalize(sale.customer_name).includes(normalize(filters.customer));
    return matchesPeriod && matchesSeller && matchesPayment && matchesCustomer;
  });
}

function getSalesByPeriod(data, tab) {
  const filters = getCurrentFilters(tab);
  return data.sales.filter((sale) => sale.status !== 'cancelled' && inPeriod(sale.created_at, filters));
}

function renderSalesReport(data) {
  const rows = getFilteredSales(data);
  const total = sum(rows, 'net_total');
  const values = rows.map((sale) => parseNumber(sale.net_total));
  const chartRows = buildDailyRows(rows, 'net_total');
  chartRows.title = 'Vendas por dia';

  return `
    ${renderMetricCards([
      { label: 'Total vendido', value: currency(total) },
      { label: 'Quantidade de vendas', value: String(rows.length) },
      { label: 'Ticket médio', value: currency(average(total, rows.length)) },
      { label: 'Maior venda', value: currency(Math.max(...values, 0)) },
      { label: 'Menor venda', value: currency(values.length ? Math.min(...values) : 0) },
    ])}
    ${renderBarChart(chartRows, currency)}
    <div class="table-shell">
      <table class="data-table reports-table">
        <thead><tr><th>Venda</th><th>Cliente</th><th>Valor</th><th>Data</th><th>Pagamento</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((sale) => `
            <tr>
              <td data-label="Venda"><strong>${escapeHtml(formatSaleNumber(sale))}</strong></td>
              <td data-label="Cliente">${escapeHtml(sale.customer_name || '-')}</td>
              <td data-label="Valor">${escapeHtml(currency(sale.net_total))}</td>
              <td data-label="Data">${escapeHtml(formatDate(sale.created_at))}</td>
              <td data-label="Pagamento">${escapeHtml(paymentLabels[sale.payment_method] || sale.payment_method || '-')}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="table-empty">Nenhuma venda no período.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function buildProductRows(data, salesRows) {
  const salesById = new Map(salesRows.map((sale) => [sale.id, sale]));
  const map = new Map();
  data.saleItems.forEach((item) => {
    if (!salesById.has(item.sale_id)) return;
    const key = item.product_id || item.product_name;
    const current = map.get(key) || { product: item.product_name || 'Produto', quantity: 0, revenue: 0 };
    current.quantity += parseNumber(item.quantity);
    current.revenue += parseNumber(item.subtotal);
    map.set(key, current);
  });
  return [...map.values()];
}

function renderProductRanking(title, rows) {
  return `
    <article class="reports-card">
      <div class="reports-card__header"><h3>${escapeHtml(title)}</h3></div>
      ${rows.length ? `
        <ol class="reports-ranked-list">
          ${rows.map((row) => `
            <li>
              <span>${escapeHtml(row.product)}</span>
              <strong>${escapeHtml(row.quantity)} un. · ${escapeHtml(currency(row.revenue))}</strong>
            </li>
          `).join('')}
        </ol>
      ` : renderEmpty()}
    </article>
  `;
}

function renderProductsReport(data) {
  const filters = getCurrentFilters('products');
  const salesRows = getSalesByPeriod(data, 'products');
  let rows = buildProductRows(data, salesRows);
  if (filters.product) {
    rows = rows.filter((row) => normalize(row.product).includes(normalize(filters.product)));
  }
  const best = [...rows].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 20);
  const worst = [...rows].sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue).slice(0, 20);

  return `
    ${renderMetricCards([
      { label: 'Produtos vendidos', value: String(rows.length) },
      { label: 'Quantidade total', value: String(sum(rows, 'quantity')) },
      { label: 'Faturamento gerado', value: currency(sum(rows, 'revenue')) },
    ])}
    <div class="reports-two-columns">
      ${renderProductRanking('Mais vendidos', best)}
      ${renderProductRanking('Menos vendidos', worst)}
    </div>
    <div class="table-shell">
      <table class="data-table reports-table">
        <thead><tr><th>Produto</th><th>Quantidade vendida</th><th>Faturamento gerado</th></tr></thead>
        <tbody>
          ${rows.length ? rows.sort((a, b) => b.quantity - a.quantity).map((row) => `
            <tr>
              <td data-label="Produto"><strong>${escapeHtml(row.product)}</strong></td>
              <td data-label="Quantidade vendida">${escapeHtml(row.quantity)}</td>
              <td data-label="Faturamento gerado">${escapeHtml(currency(row.revenue))}</td>
            </tr>
          `).join('') : '<tr><td colspan="3" class="table-empty">Nenhum produto vendido no período.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderCustomersReport(data) {
  const filters = getCurrentFilters('customers');
  const rows = getSalesByPeriod(data, 'customers');
  const map = new Map();
  rows.forEach((sale) => {
    const key = sale.customer_id || sale.customer_name;
    const current = map.get(key) || {
      customer: sale.customer_name || 'Cliente',
      purchases: 0,
      total: 0,
      lastPurchase: '',
      city: data.customers?.find((customer) => customer.id === sale.customer_id)?.city || '',
    };
    current.purchases += 1;
    current.total += parseNumber(sale.net_total);
    const saleDate = dateKey(sale.created_at);
    current.lastPurchase = current.lastPurchase && current.lastPurchase > saleDate ? current.lastPurchase : saleDate;
    map.set(key, current);
  });
  let customers = [...map.values()];
  if (filters.city) customers = customers.filter((row) => normalize(row.city).includes(normalize(filters.city)));
  const latestPurchase = customers
    .map((row) => row.lastPurchase)
    .filter(Boolean)
    .sort()
    .at(-1);
  customers.sort((a, b) => b.total - a.total || b.purchases - a.purchases);

  return `
    ${renderMetricCards([
      { label: 'Clientes compradores', value: String(customers.length) },
      { label: 'Compras no período', value: String(sum(customers, 'purchases')) },
      { label: 'Valor total comprado', value: currency(sum(customers, 'total')) },
      { label: 'Ticket médio geral', value: currency(average(sum(customers, 'total'), sum(customers, 'purchases'))) },
      { label: 'Última compra', value: latestPurchase ? formatDate(latestPurchase) : '-' },
    ])}
    <article class="reports-card">
      <div class="reports-card__header"><h3>Top clientes</h3></div>
      ${customers.length ? `
        <ol class="reports-ranked-list">
          ${customers.slice(0, 20).map((row) => `
            <li><span>${escapeHtml(row.customer)}</span><strong>${escapeHtml(currency(row.total))}</strong></li>
          `).join('')}
        </ol>
      ` : renderEmpty()}
    </article>
    <div class="table-shell">
      <table class="data-table reports-table">
        <thead><tr><th>Cliente</th><th>Compras</th><th>Valor total</th><th>Ticket médio</th><th>Última compra</th></tr></thead>
        <tbody>
          ${customers.length ? customers.map((row) => `
            <tr>
              <td data-label="Cliente"><strong>${escapeHtml(row.customer)}</strong></td>
              <td data-label="Compras">${escapeHtml(row.purchases)}</td>
              <td data-label="Valor total">${escapeHtml(currency(row.total))}</td>
              <td data-label="Ticket médio">${escapeHtml(currency(average(row.total, row.purchases)))}</td>
              <td data-label="Última compra">${escapeHtml(formatDate(row.lastPurchase))}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="table-empty">Nenhum cliente no período.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function getFilteredOrders(data) {
  const filters = getCurrentFilters('orders');
  return data.orders.filter((order) => inPeriod(order.created_at, filters));
}

function renderOrdersReport(data) {
  const rows = getFilteredOrders(data);
  const statusRows = Object.entries(orderStatusLabels).map(([status, label]) => ({
    label,
    value: rows.filter((order) => order.order_status === status).length,
  }));

  return `
    ${renderMetricCards([
      { label: 'Total de pedidos', value: String(rows.length) },
      { label: 'Pedidos pagos', value: String(rows.filter((order) => order.payment_status === 'paid').length) },
      { label: 'Pedidos cancelados', value: String(rows.filter((order) => order.order_status === 'cancelled').length) },
      { label: 'Pedidos entregues', value: String(rows.filter((order) => ['delivered', 'finalized'].includes(order.order_status)).length) },
    ])}
    ${renderStatusChart(statusRows)}
    <div class="table-shell">
      <table class="data-table reports-table">
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Valor</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((order) => `
            <tr>
              <td data-label="Pedido"><strong>${escapeHtml(formatOrderNumber(order))}</strong></td>
              <td data-label="Cliente">${escapeHtml(order.customer_name || '-')}</td>
              <td data-label="Status"><span class="status-badge status-badge--info">${escapeHtml(orderStatusLabels[order.order_status] || order.order_status)}</span></td>
              <td data-label="Valor">${escapeHtml(currency(order.total))}</td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="table-empty">Nenhum pedido no período.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function getFilteredFinance(data) {
  const filters = getCurrentFilters('finance');
  return data.entries.filter((entry) => {
    const matchesPeriod = inPeriodByKey(getFinancialDate(entry, data.expenses), filters);
    const matchesExpenseCategory = !filters.category || entry.type !== 'expense' || entry.category === filters.category;
    const expense = getEntryExpense(entry, data.expenses);
    const matchesSupplier = !filters.supplier || entry.type !== 'expense' || expense?.supplier_id === filters.supplier;
    return entry.status === 'active' && matchesPeriod && matchesExpenseCategory && matchesSupplier;
  });
}

function groupAmount(rows, getKey) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    map.set(key, (map.get(key) || 0) + parseNumber(row.amount));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderAmountBreakdown(title, rows) {
  return `
    <article class="reports-card">
      <div class="reports-card__header"><h3>${escapeHtml(title)}</h3></div>
      ${rows.length ? `
        <div class="reports-breakdown-list">
          ${rows.map(([label, amount]) => `<div><span>${escapeHtml(label || 'Outros')}</span><strong>${escapeHtml(currency(amount))}</strong></div>`).join('')}
        </div>
      ` : renderEmpty()}
    </article>
  `;
}

function getFinanceCategoryLabel(value) {
  return financeCategoryLabels[value] || value || 'Outros';
}

function getFinanceTypeLabel(value) {
  return financeTypeLabels[value] || value || '-';
}

function getFinanceOriginLabel(entry) {
  return financeCategoryLabels[entry.category] || financeOriginLabels[entry.reference_type] || getFinanceTypeLabel(entry.type);
}

function getEntryExpense(entry, expenses) {
  return expenses.find((item) => item.financial_entry_id === entry.id || item.id === entry.reference_id) || null;
}

function getExpenseFinancialDate(expense) {
  if (!expense) return '';
  if (expense.status === 'paid' && expense.paid_at) return dateKey(expense.paid_at);
  if (expense.status !== 'paid' && expense.due_date) return expense.due_date;
  return expense.expense_date || dateKey(expense.created_at);
}

function getFinancialDate(entry, expenses) {
  if (entry.type === 'expense') {
    const expense = getEntryExpense(entry, expenses);
    return getExpenseFinancialDate(expense) || dateKey(entry.created_at);
  }
  return dateKey(entry.created_at);
}

function renderFinanceReport(data) {
  const rows = getFilteredFinance(data);
  const incomeRows = rows.filter((entry) => entry.type === 'income');
  const expenseRows = rows.filter((entry) => entry.type === 'expense');
  const income = sum(incomeRows, 'amount');
  const expense = sum(expenseRows, 'amount');

  return `
    ${renderMetricCards([
      { label: 'Receitas', value: currency(income) },
      { label: 'Despesas', value: currency(expense) },
      { label: 'Saldo', value: currency(income - expense) },
    ])}
    <div class="reports-two-columns">
      ${renderAmountBreakdown('Receitas por origem', groupAmount(incomeRows, getFinanceOriginLabel))}
      ${renderAmountBreakdown('Despesas por tipo', groupAmount(expenseRows, (entry) => getFinanceCategoryLabel(entry.category)))}
    </div>
    <div class="table-shell">
      <table class="data-table reports-table">
        <thead><tr><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Data</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((entry) => `
            <tr>
              <td data-label="Tipo">${escapeHtml(getFinanceTypeLabel(entry.type))}</td>
              <td data-label="Categoria">${escapeHtml(getFinanceCategoryLabel(entry.category))}</td>
              <td data-label="Descrição">${escapeHtml(entry.description || '-')}</td>
              <td data-label="Valor">${escapeHtml(currency(entry.amount))}</td>
              <td data-label="Data">${escapeHtml(formatDate(getFinancialDate(entry, data.expenses)))}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="table-empty">Nenhum lançamento no período.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderStockReport(data) {
  const filters = getCurrentFilters('stock');
  let rows = data.stockRows.map((row) => ({
    variation_id: row.variation_id,
    product_id: row.product_id,
    product: row.product_name,
    color: row.color_name || '-',
    size: row.size,
    quantity: parseNumber(row.quantity),
    minimum_stock: parseNumber(row.minimum_stock),
  }));
  if (filters.product) rows = rows.filter((row) => normalize(row.product).includes(normalize(filters.product)));
  rows.sort((a, b) => a.quantity - b.quantity || a.product.localeCompare(b.product));
  const salesInPeriod = (data.sales || []).filter((sale) => sale.status !== 'cancelled' && inPeriod(sale.created_at, filters));
  const salesIdsInPeriod = new Set(salesInPeriod.map((sale) => sale.id));
  const soldVariationIds = new Set((data.saleItems || [])
    .filter((item) => salesIdsInPeriod.has(item.sale_id))
    .map((item) => item.variation_id)
    .filter(Boolean));
  const idleRows = data.saleItemsAvailable
    ? rows.filter((row) => row.quantity > 0 && !soldVariationIds.has(row.variation_id)).slice(0, 20)
    : [];

  return `
    ${renderMetricCards([
      { label: 'Produtos sem estoque', value: String(rows.filter((row) => row.quantity <= 0).length) },
      { label: 'Abaixo do mínimo', value: String(rows.filter((row) => row.quantity > 0 && row.quantity <= row.minimum_stock).length) },
      { label: 'Variações monitoradas', value: String(rows.length) },
    ])}
    <article class="reports-card">
      <div class="reports-card__header"><h3>Menor estoque</h3></div>
      ${rows.length ? `
        <ol class="reports-ranked-list">
          ${rows.slice(0, 20).map((row) => `
            <li><span>${escapeHtml(row.product)} · ${escapeHtml(row.color)} / ${escapeHtml(row.size)}</span><strong>${escapeHtml(row.quantity)}</strong></li>
          `).join('')}
        </ol>
      ` : renderEmpty()}
    </article>
    <article class="reports-card">
      <div class="reports-card__header"><h3>Produtos parados</h3></div>
      ${data.saleItemsAvailable ? `
        ${idleRows.length ? `
          <ol class="reports-ranked-list">
            ${idleRows.map((row) => `
              <li><span>${escapeHtml(row.product)} · ${escapeHtml(row.color)} / ${escapeHtml(row.size)}</span><strong>${escapeHtml(row.quantity)} em estoque</strong></li>
            `).join('')}
          </ol>
        ` : renderEmpty('Nenhum produto parado encontrado no período.')}
      ` : '<p class="table-empty">TODO: calcular produtos parados com precisão quando os itens de venda estiverem disponíveis para este perfil.</p>'}
    </article>
    <div class="table-shell">
      <table class="data-table reports-table">
        <thead><tr><th>Produto</th><th>Cor</th><th>Tamanho</th><th>Estoque atual</th><th>Estoque mínimo</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((row) => `
            <tr>
              <td data-label="Produto"><strong>${escapeHtml(row.product)}</strong></td>
              <td data-label="Cor">${escapeHtml(row.color)}</td>
              <td data-label="Tamanho">${escapeHtml(row.size)}</td>
              <td data-label="Estoque atual">${escapeHtml(row.quantity)}</td>
              <td data-label="Estoque mínimo">${escapeHtml(row.minimum_stock)}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="table-empty">Nenhuma variação encontrada.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabs() {
  const tabs = reportTabs.filter((tab) => !tab.adminOnly || reportState.isAdmin);
  return `
    <div class="reports-tabs" role="tablist" aria-label="Relatórios">
      ${tabs.map((tab) => `
        <button class="reports-tab ${tab.id === reportState.activeTab ? 'is-active' : ''}" type="button" role="tab" data-report-tab="${tab.id}">
          ${escapeHtml(tab.label)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderFilters(data = {}) {
  const tab = reportState.activeTab;
  const filters = getCurrentFilters(tab);
  const dateFrom = filters.dateFrom || monthStartKey();
  const dateTo = filters.dateTo || todayKey();

  if (tab === 'sales') {
    const sellers = data.sellers || [];
    return `
      <form class="filters-bar reports-filters reports-filters--sales" data-reports-filters>
        <label class="form-field"><span>Período inicial</span><input name="dateFrom" type="date" value="${escapeHtml(dateFrom)}" /></label>
        <label class="form-field"><span>Período final</span><input name="dateTo" type="date" value="${escapeHtml(dateTo)}" /></label>
        <label class="form-field"><span>Vendedor</span><select name="seller"><option value="">Todos</option>${sellers.map((seller) => `<option value="${seller.id}" ${filters.seller === seller.id ? 'selected' : ''}>${escapeHtml(seller.name || seller.email || 'Vendedor')}</option>`).join('')}</select></label>
        <label class="form-field"><span>Pagamento</span><select name="payment"><option value="">Todos</option>${Object.entries(paymentLabels).map(([key, label]) => `<option value="${key}" ${filters.payment === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
        <label class="form-field"><span>Cliente</span><input name="customer" type="search" value="${escapeHtml(filters.customer || '')}" placeholder="Nome do cliente" /></label>
        <button class="button button--secondary" type="button" data-export-report>Exportar CSV</button>
      </form>
    `;
  }

  if (tab === 'products') {
    return `
      <form class="filters-bar reports-filters reports-filters--compact" data-reports-filters>
        <label class="form-field"><span>Período inicial</span><input name="dateFrom" type="date" value="${escapeHtml(dateFrom)}" /></label>
        <label class="form-field"><span>Período final</span><input name="dateTo" type="date" value="${escapeHtml(dateTo)}" /></label>
        <label class="form-field"><span>Produto</span><input name="product" type="search" value="${escapeHtml(filters.product || '')}" placeholder="Nome do produto" /></label>
        <button class="button button--secondary" type="button" data-export-report>Exportar CSV</button>
      </form>
    `;
  }

  if (tab === 'customers') {
    return `
      <form class="filters-bar reports-filters reports-filters--compact" data-reports-filters>
        <label class="form-field"><span>Período inicial</span><input name="dateFrom" type="date" value="${escapeHtml(dateFrom)}" /></label>
        <label class="form-field"><span>Período final</span><input name="dateTo" type="date" value="${escapeHtml(dateTo)}" /></label>
        <label class="form-field"><span>Cidade</span><input name="city" type="search" value="${escapeHtml(filters.city || '')}" placeholder="Cidade" /></label>
        <button class="button button--secondary" type="button" data-export-report>Exportar CSV</button>
      </form>
    `;
  }

  if (tab === 'orders') {
    return `
      <form class="filters-bar reports-filters reports-filters--small" data-reports-filters>
        <label class="form-field"><span>Período inicial</span><input name="dateFrom" type="date" value="${escapeHtml(dateFrom)}" /></label>
        <label class="form-field"><span>Período final</span><input name="dateTo" type="date" value="${escapeHtml(dateTo)}" /></label>
        <button class="button button--secondary" type="button" data-export-report>Exportar CSV</button>
      </form>
    `;
  }

  if (tab === 'finance' && reportState.isAdmin) {
    const categories = [...new Set((data.entries || []).filter((entry) => entry.type === 'expense').map((entry) => entry.category).filter(Boolean))].sort();
    return `
      <form class="filters-bar reports-filters reports-filters--finance" data-reports-filters>
        <label class="form-field"><span>Período inicial</span><input name="dateFrom" type="date" value="${escapeHtml(dateFrom)}" /></label>
        <label class="form-field"><span>Período final</span><input name="dateTo" type="date" value="${escapeHtml(dateTo)}" /></label>
        <label class="form-field"><span>Categoria</span><select name="category"><option value="">Todas</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${filters.category === category ? 'selected' : ''}>${escapeHtml(getFinanceCategoryLabel(category))}</option>`).join('')}</select></label>
        <label class="form-field"><span>Fornecedor</span><select name="supplier"><option value="">Todos</option>${(data.suppliers || []).map((supplier) => `<option value="${supplier.id}" ${filters.supplier === supplier.id ? 'selected' : ''}>${escapeHtml(supplier.name)}</option>`).join('')}</select></label>
        <button class="button button--secondary" type="button" data-export-report>Exportar CSV</button>
      </form>
    `;
  }

  return `
    <form class="filters-bar reports-filters reports-filters--compact" data-reports-filters>
      <label class="form-field"><span>Período inicial</span><input name="dateFrom" type="date" value="${escapeHtml(dateFrom)}" /></label>
      <label class="form-field"><span>Período final</span><input name="dateTo" type="date" value="${escapeHtml(dateTo)}" /></label>
      <label class="form-field"><span>Produto</span><input name="product" type="search" value="${escapeHtml(filters.product || '')}" placeholder="Nome do produto" /></label>
      <button class="button button--secondary" type="button" data-export-report>Exportar CSV</button>
    </form>
  `;
}

async function loadActiveTabData() {
  if (reportState.activeTab === 'sales') return loadSalesReport();
  if (reportState.activeTab === 'products') return loadSalesReport();
  if (reportState.activeTab === 'customers') {
    if (reportState.cache.customers) return reportState.cache.customers;
    const salesData = await loadSalesReport();
    const customerIds = [...new Set(salesData.sales.map((sale) => sale.customer_id).filter(Boolean))];
    const customers = customerIds.length
      ? await safeQuery(supabase.from('customers').select('id, name, city').in('id', customerIds))
      : [];
    reportState.cache.customers = { ...salesData, customers };
    return reportState.cache.customers;
  }
  if (reportState.activeTab === 'orders') return loadOrdersReport();
  if (reportState.activeTab === 'finance' && reportState.isAdmin) return loadFinanceReport();
  return loadStockReport();
}

function renderActiveReport(data) {
  if (reportState.activeTab === 'sales') return renderSalesReport(data);
  if (reportState.activeTab === 'products') return renderProductsReport(data);
  if (reportState.activeTab === 'customers') return renderCustomersReport(data);
  if (reportState.activeTab === 'orders') return renderOrdersReport(data);
  if (reportState.activeTab === 'finance' && reportState.isAdmin) return renderFinanceReport(data);
  return renderStockReport(data);
}

function syncFilters(container) {
  const form = container.querySelector('[data-reports-filters]');
  if (!form) return;
  const values = Object.fromEntries(new FormData(form).entries());
  setCurrentFilters(reportState.activeTab, values);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows) {
  const content = rows.map((row) => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportActiveReport(container) {
  syncFilters(container);
  const data = await loadActiveTabData();
  const tab = reportState.activeTab;
  let rows = [];

  if (tab === 'sales') {
    rows = [['Venda', 'Cliente', 'Valor', 'Data', 'Pagamento'], ...getFilteredSales(data).map((sale) => [
      formatSaleNumber(sale), sale.customer_name || '-', sale.net_total, formatDate(sale.created_at), paymentLabels[sale.payment_method] || sale.payment_method || '-',
    ])];
  } else if (tab === 'products') {
    const filters = getCurrentFilters('products');
    const productRows = buildProductRows(data, getSalesByPeriod(data, 'products'))
      .filter((row) => !filters.product || normalize(row.product).includes(normalize(filters.product)));
    rows = [['Produto', 'Quantidade vendida', 'Faturamento gerado'], ...productRows.map((row) => [row.product, row.quantity, row.revenue])];
  } else if (tab === 'customers') {
    const htmlData = data;
    const map = new Map();
    const filters = getCurrentFilters('customers');
    getSalesByPeriod(htmlData, 'customers').forEach((sale) => {
      const customer = htmlData.customers?.find((item) => item.id === sale.customer_id);
      if (filters.city && !normalize(customer?.city).includes(normalize(filters.city))) return;
      const current = map.get(sale.customer_id) || { customer: sale.customer_name || 'Cliente', purchases: 0, total: 0, lastPurchase: '' };
      current.purchases += 1;
      current.total += parseNumber(sale.net_total);
      const saleDate = dateKey(sale.created_at);
      current.lastPurchase = current.lastPurchase && current.lastPurchase > saleDate ? current.lastPurchase : saleDate;
      map.set(sale.customer_id, current);
    });
    rows = [['Cliente', 'Compras', 'Valor total', 'Ticket médio', 'Última compra'], ...[...map.values()].map((row) => [row.customer, row.purchases, row.total, average(row.total, row.purchases), formatDate(row.lastPurchase)])];
  } else if (tab === 'orders') {
    rows = [['Pedido', 'Cliente', 'Status', 'Valor'], ...getFilteredOrders(data).map((order) => [
      formatOrderNumber(order), order.customer_name || '-', orderStatusLabels[order.order_status] || order.order_status, order.total,
    ])];
  } else if (tab === 'finance' && reportState.isAdmin) {
    rows = [['Tipo', 'Categoria', 'Descrição', 'Valor', 'Data'], ...getFilteredFinance(data).map((entry) => [
      getFinanceTypeLabel(entry.type), getFinanceCategoryLabel(entry.category), entry.description || '-', entry.amount, formatDate(getFinancialDate(entry, data.expenses)),
    ])];
  } else {
    const filters = getCurrentFilters('stock');
    const salesInPeriod = (data.sales || []).filter((sale) => sale.status !== 'cancelled' && inPeriod(sale.created_at, filters));
    const salesIdsInPeriod = new Set(salesInPeriod.map((sale) => sale.id));
    const soldVariationIds = new Set((data.saleItems || [])
      .filter((item) => salesIdsInPeriod.has(item.sale_id))
      .map((item) => item.variation_id)
      .filter(Boolean));
    const stockRows = data.stockRows
      .filter((row) => !filters.product || normalize(row.product_name).includes(normalize(filters.product)))
      .map((row) => [
        row.product_name,
        row.color_name || '-',
        row.size,
        row.quantity,
        row.minimum_stock,
        data.saleItemsAvailable
          ? Number(row.quantity || 0) > 0 && !soldVariationIds.has(row.variation_id) ? 'Sim' : 'Não'
          : 'Indisponível',
      ]);
    rows = [['Produto', 'Cor', 'Tamanho', 'Estoque atual', 'Estoque mínimo', 'Produto parado'], ...stockRows];
  }

  downloadCsv(`relatorio-${tab}-${todayKey()}.csv`, rows);
}

async function renderReportBody(container) {
  const filtersTarget = container.querySelector('[data-reports-filter-area]');
  const contentTarget = container.querySelector('[data-reports-content]');
  contentTarget.innerHTML = renderLoading();

  try {
    const data = await loadActiveTabData();
    filtersTarget.innerHTML = renderFilters(data);
    contentTarget.innerHTML = renderActiveReport(data);
  } catch (error) {
    console.error('Erro ao carregar relatório:', error);
    contentTarget.innerHTML = renderEmpty(`Não foi possível carregar o relatório: ${error.message}`);
  }
}

function renderShell(container, route) {
  container.innerHTML = `
    <section class="module-panel reports-module" aria-labelledby="reports-title">
      <div class="module-header">
        <div>
          <p class="eyebrow">${escapeHtml(route.label)}</p>
          <h2 id="reports-title">Relatórios</h2>
          <p class="module-panel__text">Análises somente leitura para acompanhar vendas, produtos, clientes, pedidos e estoque.</p>
        </div>
        ${renderPeriodSegmentedControl({ id: 'reports', value: 'today' })}
      </div>
      ${renderTabs()}
      <div data-reports-filter-area></div>
      <div class="reports-content" data-reports-content>${renderLoading()}</div>
    </section>
  `;
}

function bindReportsEvents(container) {
  const signal = reportState.abortController.signal;
  bindPeriodSegmentedControl(container, { id: 'reports', value: 'today', onChange: async (range) => {
    const filters = container.querySelector('[data-reports-filter-area]');
    const from = filters?.querySelector('[name="date_from"]');
    const to = filters?.querySelector('[name="date_to"]');
    if (from && to) { from.value = range.dateFrom; to.value = range.dateTo; syncFilters(container); }
    await renderReportBody(container);
  } });

  container.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('[data-report-tab]');
    const exportButton = event.target.closest('[data-export-report]');

    if (tabButton) {
      reportState.activeTab = tabButton.dataset.reportTab;
      container.querySelectorAll('[data-report-tab]').forEach((button) => {
        button.classList.toggle('is-active', button === tabButton);
      });
      await renderReportBody(container);
      return;
    }

    if (exportButton) {
      await exportActiveReport(container);
    }
  }, { signal });

  container.addEventListener('input', () => {
    syncFilters(container);
    loadActiveTabData().then((data) => {
      container.querySelector('[data-reports-content]').innerHTML = renderActiveReport(data);
    });
  }, { signal });

  container.addEventListener('change', () => {
    syncFilters(container);
    loadActiveTabData().then((data) => {
      container.querySelector('[data-reports-content]').innerHTML = renderActiveReport(data);
    });
  }, { signal });
}

const reportsCatalog = [
  { id: 'sales', label: 'Vendas', icon: 'chart', description: 'Analise suas vendas, pagamentos, descontos e desempenho da equipe.', reports: [
    ['cash_closing', 'Fechamento de Caixa', 'Resumo de vendas, Pix, dinheiro, cartão e descontos.'], ['sales_summary', 'Resumo de vendas', 'Visão geral das vendas e indicadores principais.'], ['sales_period', 'Vendas por período', 'Evolução das vendas por dia, semana ou mês.'], ['sales_payment', 'Vendas por forma de pagamento', 'Análise de pagamentos utilizados.'], ['sales_seller', 'Vendas por vendedor', 'Desempenho da equipe de vendas.'], ['sales_cancelled', 'Vendas canceladas', 'Vendas canceladas e motivos de cancelamento.'], ['sales_discounts', 'Descontos concedidos', 'Descontos aplicados nas vendas.'], ['sales_ticket', 'Ticket médio', 'Ticket médio de vendas no período.'], ['sales_pieces', 'Peças vendidas', 'Quantidade total de peças vendidas.'], ['sales_model', 'Vendas por modelo', 'Vendas agrupadas por modelo.'], ['sales_color', 'Vendas por cor', 'Vendas agrupadas por cor.'], ['sales_size', 'Vendas por tamanho', 'Vendas agrupadas por tamanho.'] ] },
  { id: 'products', label: 'Produtos', icon: 'package', description: 'Acompanhe a performance dos produtos, modelos, cores e tamanhos.', reports: [
    ['products_top', 'Produtos mais vendidos', 'Ranking de produtos por quantidade vendida.'], ['products_low', 'Produtos menos vendidos', 'Produtos com menor saída.'], ['products_idle', 'Produtos parados', 'Produtos sem movimentação no período.'], ['products_category', 'Produtos por categoria', 'Desempenho por categoria.'], ['products_model', 'Produtos por modelo', 'Desempenho por modelo.'], ['products_color', 'Produtos por cor', 'Desempenho por cor.'], ['products_size', 'Produtos por tamanho', 'Desempenho por tamanho.'], ['products_margin', 'Margem por produto', 'Margem detalhada por produto.', true] ] },
  { id: 'stock', label: 'Estoque', icon: 'boxes', description: 'Controle o estoque atual, movimentações e produtos parados.', reports: [
    ['stock_current', 'Estoque atual', 'Situação atual de todas as variações.'], ['stock_critical', 'Estoque crítico', 'Produtos abaixo do estoque mínimo.'], ['stock_zero', 'Estoque zerado', 'Variações indisponíveis.'], ['stock_moves', 'Movimentações', 'Entradas, saídas e ajustes.'], ['stock_in', 'Entradas', 'Entradas recentes de estoque.'], ['stock_out', 'Saídas', 'Saídas por venda ou ajuste.'], ['stock_adjustments', 'Ajustes', 'Ajustes manuais de estoque.'], ['stock_value', 'Valor do estoque', 'Valor estimado em estoque.'] ] },
  { id: 'customers', label: 'Clientes', icon: 'users', description: 'Conheça seus clientes, recorrência, ticket médio e cidades.', reports: [
    ['customers_top', 'Clientes que mais compraram', 'Ranking de clientes por faturamento.'], ['customers_returning', 'Clientes recorrentes', 'Clientes com mais de uma compra.'], ['customers_new', 'Novos clientes', 'Clientes com primeira compra no período.'], ['customers_inactive', 'Clientes inativos', 'Clientes sem compras recentes.'], ['customers_city', 'Compras por cidade', 'Distribuição de compras por cidade.'], ['customers_ticket', 'Ticket médio por cliente', 'Valor médio por cliente.'] ] },
  { id: 'finance', label: 'Financeiro', icon: 'wallet', description: 'Receitas, despesas, lucro, contas e fluxo de caixa.', adminOnly: true, reports: [
    ['finance_income', 'Receitas', 'Receitas recebidas no período.'], ['finance_expenses', 'Despesas', 'Despesas registradas no período.'], ['finance_profit', 'Lucro líquido', 'Resultado entre receitas e despesas.'], ['finance_cashflow', 'Fluxo de caixa', 'Evolução de entradas e saídas.'], ['finance_paid', 'Contas pagas', 'Contas quitadas no período.'], ['finance_pending', 'Contas pendentes', 'Contas aguardando pagamento.'], ['finance_overdue', 'Contas vencidas', 'Contas fora do vencimento.'], ['finance_category', 'Despesas por categoria', 'Distribuição de despesas por categoria.'] ] },
  { id: 'orders', label: 'Pedidos Online', icon: 'truck', description: 'Acompanhe pedidos, status, faturamento e logística.', comingSoon: true, reports: [
    ['orders_status', 'Pedidos por status', 'Pedidos agrupados por status.'], ['orders_sent', 'Pedidos enviados', 'Pedidos enviados no período.'], ['orders_cancelled', 'Pedidos cancelados', 'Pedidos cancelados no período.'], ['orders_expired', 'Pedidos expirados', 'Pedidos Pix expirados.'], ['orders_separation', 'Tempo médio de separação', 'Tempo entre pagamento e separação.'], ['orders_shipping', 'Tempo médio de envio', 'Tempo entre separação e postagem.'], ['orders_revenue', 'Faturamento online', 'Faturamento dos pedidos online.'] ] },
];

function reportIcon(name) {
  const icons = {
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', package: '<path d="m3 7 9-5 9 5v10l-9 5-9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/>', boxes: '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>', users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>', wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h.01"/>', truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>', arrow: '<path d="m9 18 6-6-6-6"/>', download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>', file: '<path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>' };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] || icons.file}</svg>`;
}

function visibleReportCategories() {
  return reportsCatalog.filter((category) => reportState.isAdmin || (!category.adminOnly && category.id === 'sales'));
}

function getReportCategory(id) { return reportsCatalog.find((category) => category.id === id); }
function getReportDefinition() { return getReportCategory(reportState.category)?.reports.find(([key]) => key === reportState.reportKey); }

function setAllReportPeriods(range) {
  reportTabs.forEach((tab) => setCurrentFilters(tab.id, { ...getCurrentFilters(tab.id), dateFrom: range.dateFrom, dateTo: range.dateTo }));
}

function buildReportSummary(data) {
  const sales = getSalesByPeriod(data, 'sales');
  const total = sum(sales, 'net_total');
  const saleIds = new Set(sales.map((sale) => sale.id));
  const pieces = (data.saleItems || []).filter((item) => saleIds.has(item.sale_id)).reduce((count, item) => count + parseNumber(item.quantity), 0);
  return [
    ['Faturamento', currency(total), '↑ 12% vs. período anterior', 'wallet'],
    ['Vendas', String(sales.length), '↑ 8% vs. período anterior', 'file'],
    ['Peças vendidas', String(pieces), '↑ 10% vs. período anterior', 'package'],
    ['Ticket médio', currency(average(total, sales.length)), '↑ 6% vs. período anterior', 'chart'],
  ];
}

function renderReportsSummary(cards) {
  return `<section class="reports-v2-summary" aria-label="Resumo do período">${cards.map(([label, value, comparison, icon]) => `<article class="reports-v2-summary__card"><span class="reports-v2-icon reports-v2-icon--gold">${reportIcon(icon)}</span><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(comparison)}</small></div></article>`).join('')}</section>`;
}

function renderReportsHeaderLegacy({ breadcrumb = '', title = 'Relatórios', description = 'Acompanhe o desempenho da operação e gere análises detalhadas.', detail = false } = {}) {
  return `<header class="reports-v2-header"><div>${breadcrumb ? `<nav class="reports-v2-breadcrumb" aria-label="Navegação"><button type="button" data-reports-home>Relatórios</button>${breadcrumb}</nav>` : ''}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="reports-v2-header__actions">${renderPeriodSegmentedControl({ id: 'reports-v2', value: reportState.period })}<button class="reports-v2-action" type="button" data-reports-export>${reportIcon('download')} Exportar</button>${detail ? `<button class="reports-v2-action" type="button" data-reports-print>${reportIcon('print')} Imprimir</button>` : `<button class="reports-v2-action reports-v2-action--primary" type="button" data-reports-generate>${reportIcon('file')} Gerar relatório</button>`}</div></header>`;
}

function renderCategories() {
  return `<section class="reports-v2-section"><div class="reports-v2-section__heading"><h3>Categorias de relatórios</h3></div><div class="reports-v2-categories">${visibleReportCategories().map((category) => `<button class="reports-v2-category" type="button" data-reports-category="${category.id}"><span class="reports-v2-icon reports-v2-icon--${category.id}">${reportIcon(category.icon)}</span><span class="reports-v2-category__content"><strong>${escapeHtml(category.label)}</strong><small>${escapeHtml(category.description)}</small><em>${category.reports.length} relatórios disponíveis</em></span>${category.comingSoon ? '<b>Em breve</b>' : ''}<i>${reportIcon('arrow')}</i></button>`).join('')}</div></section>`;
}

function renderReportsHomeLegacy(data) { return `${renderReportsHeader()}${renderReportsSummary(buildReportSummary(data))}${renderCategories()}`; }

function loadRecentReports() {
  try { return JSON.parse(sessionStorage.getItem('vb-recent-reports') || '[]').slice(0, 5); } catch { return []; }
}

function saveRecentReport(format) {
  if (reportState.level !== 'report') return;
  const definition = getReportDefinition();
  if (!definition) return;
  const range = getPeriodRange(reportState.period);
  const next = [{ key: reportState.reportKey, title: definition[1], period: range.label, format, user: reportState.profile?.name || reportState.profile?.email || 'Administrador', createdAt: new Date().toISOString() }, ...reportState.recentReports.filter((item) => item.key !== reportState.reportKey)].slice(0, 5);
  reportState.recentReports = next;
  sessionStorage.setItem('vb-recent-reports', JSON.stringify(next));
}

function renderRecentReports() {
  if (!reportState.recentReports.length) return `<section class="reports-v2-recent"><div class="reports-v2-section__heading"><h3>Relatórios recentes</h3></div><p class="reports-v2-recent__empty">Os relatórios que você exportar aparecerão aqui.</p></section>`;
  return `<section class="reports-v2-recent"><div class="reports-v2-section__heading"><h3>Relatórios recentes</h3></div><div class="reports-v2-recent__list">${reportState.recentReports.map((item) => `<article><span class="reports-v2-icon">${reportIcon('file')}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.period)} · ${escapeHtml(item.user)}</small></div><em>${escapeHtml(item.format)}</em><button type="button" data-recent-download="${escapeHtml(item.key)}" aria-label="Baixar novamente">${reportIcon('download')}</button></article>`).join('')}</div></section>`;
}

function renderReportsHeader({ breadcrumb = '', title = 'Relatórios', description = 'Acesse análises detalhadas e exporte informações da operação.', detail = false } = {}) {
  const actions = detail ? `<div class="reports-v2-header__actions"><div class="reports-v2-detail-period">${renderPeriodSegmentedControl({ id: 'reports-v2', value: reportState.period })}<button type="button" data-report-period-extra="year">Ano</button><button type="button" data-report-period-extra="custom">Personalizado</button></div><button class="reports-v2-action" type="button" data-reports-pdf>${reportIcon('download')} PDF</button><button class="reports-v2-action" type="button" data-export-report>${reportIcon('download')} CSV</button><button class="reports-v2-action" type="button" data-reports-print>${reportIcon('print')} Imprimir</button></div>` : '';
  const back = breadcrumb ? `<button class="reports-v2-back" type="button" data-reports-back>${reportIcon('arrow')} Voltar</button>` : '';
  return `<header class="reports-v2-header"><div>${back}${breadcrumb ? `<nav class="reports-v2-breadcrumb" aria-label="Navegação"><button type="button" data-reports-home>Relatórios</button>${breadcrumb}</nav>` : ''}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${actions}</header>`;
}

function renderReportsHome() { return `${renderReportsHeader()}${renderCategories()}${renderRecentReports()}`; }

function renderCategoryPage(category) {
  const reports = category.reports.filter((item) => reportState.isAdmin || item[0] === 'cash_closing');
  return `${renderReportsHeader({ breadcrumb: `<span>${escapeHtml(category.label)}</span>`, title: category.label, description: 'Selecione um relatório para visualizar os dados detalhados.' })}<section class="reports-v2-section reports-v2-detail-list"><div class="reports-v2-section__heading"><h3>Relatórios de ${escapeHtml(category.label)}</h3></div><div class="reports-v2-report-grid">${reports.map(([key, title, description]) => `<button type="button" class="reports-v2-report-link" data-report-open="${key}"><span class="reports-v2-icon">${reportIcon(category.icon)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><i>${reportIcon('arrow')}</i></button>`).join('')}</div></section>`; }

function renderReportDetail(data, category, definition) {
  const [key, title, description] = definition;
  reportState.activeTab = category.id;
  return `${renderReportsHeader({ breadcrumb: `<button type="button" data-reports-category="${category.id}">${escapeHtml(category.label)}</button><span>${escapeHtml(title)}</span>`, title, description, detail: true })}<section class="reports-v2-detail"><div class="reports-v2-filter-area" data-reports-filter-area>${renderFilters(data)}</div><div class="reports-v2-detail__summary">${renderActiveReport(data)}</div></section>`;
}

async function renderReportsV2(container) {
  container.innerHTML = `<section class="module-panel reports-module reports-v2" aria-live="polite">${renderLoading()}</section>`;
  const shell = container.querySelector('.reports-v2');
  try {
    if (reportState.level === 'home') { shell.innerHTML = renderReportsHome(); return; }
    const category = getReportCategory(reportState.category);
    if (!category || (!reportState.isAdmin && category.id !== 'sales')) { reportState.level = 'home'; shell.innerHTML = renderReportsHome(); return; }
    if (reportState.level === 'category') { shell.innerHTML = renderCategoryPage(category); return; }
    reportState.activeTab = category.id;
    const data = await loadActiveTabData();
    const definition = getReportDefinition() || category.reports[0];
    shell.innerHTML = renderReportDetail(data, category, definition);
  } catch (error) { shell.innerHTML = renderEmpty(`Não foi possível carregar os relatórios: ${error.message}`); }
}

function exportReportsPdf(container) {
  const target = container.querySelector('.reports-v2');
  if (window.html2pdf && target) {
    window.html2pdf().set({ margin: 8, filename: `relatorio-${reportState.reportKey || reportState.category || 'geral'}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(target).save();
    return;
  }
  window.print();
}

function bindReportsV2Events(container) {
  const signal = reportState.abortController.signal;
  bindPeriodSegmentedControl(container, { id: 'reports-v2', value: reportState.period, onChange: async (range) => { reportState.period = range.value; setAllReportPeriods(range); await renderReportsV2(container); bindReportsV2Events(container); } });
  if (reportState.eventsBound) return;
  reportState.eventsBound = true;
  container.addEventListener('click', async (event) => {
    const categoryButton = event.target.closest('[data-reports-category]');
    const reportButton = event.target.closest('[data-report-open]');
    const recentButton = event.target.closest('[data-recent-download]');
    if (event.target.closest('[data-reports-home]')) { reportState.level = 'home'; reportState.category = null; reportState.reportKey = null; await renderReportsV2(container); bindReportsV2Events(container); return; }
    if (event.target.closest('[data-reports-back]')) { if (reportState.level === 'report') { reportState.level = 'category'; reportState.reportKey = null; } else { reportState.level = 'home'; reportState.category = null; } await renderReportsV2(container); bindReportsV2Events(container); return; }
    if (categoryButton) { reportState.level = 'category'; reportState.category = categoryButton.dataset.reportsCategory; reportState.reportKey = null; await renderReportsV2(container); bindReportsV2Events(container); return; }
    if (reportButton) { reportState.level = 'report'; reportState.reportKey = reportButton.dataset.reportOpen; await renderReportsV2(container); bindReportsV2Events(container); return; }
    if (recentButton) {
      const category = reportsCatalog.find((item) => item.reports.some(([key]) => key === recentButton.dataset.recentDownload));
      if (!category) return;
      reportState.level = 'report'; reportState.category = category.id; reportState.reportKey = recentButton.dataset.recentDownload;
      await renderReportsV2(container); bindReportsV2Events(container); await exportActiveReport(container); return;
    }
    if (event.target.closest('[data-reports-generate]')) { reportState.level = 'category'; reportState.category = 'sales'; await renderReportsV2(container); bindReportsV2Events(container); return; }
    if (event.target.closest('[data-reports-export]')) { if (reportState.level === 'report') { saveRecentReport('PDF'); exportReportsPdf(container); } return; }
    if (event.target.closest('[data-reports-pdf]')) { saveRecentReport('PDF'); exportReportsPdf(container); return; }
    if (event.target.closest('[data-export-report]')) { saveRecentReport('CSV'); await exportActiveReport(container); return; }
    if (event.target.closest('[data-reports-print]')) { saveRecentReport('Impressão'); window.print(); return; }
    const extendedPeriod = event.target.closest('[data-report-period-extra]');
    if (extendedPeriod) {
      const today = new Date();
      const from = extendedPeriod.dataset.reportPeriodExtra === 'year' ? new Date(today.getFullYear(), 0, 1) : new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const range = { dateFrom: dateKey(from), dateTo: dateKey(today) };
      setAllReportPeriods(range);
      await renderReportsV2(container); bindReportsV2Events(container);
    }
  }, { signal });
  container.addEventListener('input', async (event) => { if (!event.target.closest('[data-reports-filters]')) return; syncFilters(container); await renderReportsV2(container); bindReportsV2Events(container); }, { signal });
  container.addEventListener('change', async (event) => { if (!event.target.closest('[data-reports-filters]')) return; syncFilters(container); await renderReportsV2(container); bindReportsV2Events(container); }, { signal });
}

export async function renderReports(container, route, context = {}) {
  reportState.abortController?.abort();
  reportState.abortController = new AbortController();
  reportState.profile = context.profile;
  reportState.isAdmin = isAdmin(context.profile);
  reportState.activeTab = 'sales';
  reportState.level = 'home';
  reportState.category = null;
  reportState.reportKey = null;
  reportState.period = 'today';
  reportState.eventsBound = false;
  reportState.recentReports = loadRecentReports();
  reportState.favorites = new Set();
  reportState.cache = {};
  reportState.filters = {
    sales: { dateFrom: monthStartKey(), dateTo: todayKey() },
    products: { dateFrom: monthStartKey(), dateTo: todayKey() },
    customers: { dateFrom: monthStartKey(), dateTo: todayKey() },
    orders: { dateFrom: monthStartKey(), dateTo: todayKey() },
    finance: { dateFrom: monthStartKey(), dateTo: todayKey() },
    stock: { dateFrom: monthStartKey(), dateTo: todayKey() },
  };

  const initialRange = getPeriodRange(reportState.period);
  setAllReportPeriods(initialRange);
  await renderReportsV2(container);
  bindReportsV2Events(container);
}
