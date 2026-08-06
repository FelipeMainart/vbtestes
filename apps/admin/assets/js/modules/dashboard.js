import { getBrandLogoSrc } from '../config/branding.js';
import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';

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

let dashboardRequestId = 0;

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
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatTime(value) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function paymentLabel(value) {
  const labels = {
    pix: 'PIX',
    cash: 'Dinheiro',
    credit_card: 'Cartão',
    debit_card: 'Cartão',
    card: 'Cartão',
    bank_transfer: 'Transferência',
  };
  return labels[value] || value || 'Pagamento';
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(reference = new Date()) {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function addDays(reference, days) {
  const date = new Date(reference);
  date.setDate(date.getDate() + days);
  return date;
}

function summarizeSalesPeriod(sales, saleItems, start, end) {
  const periodSales = sales.filter((sale) => {
    const createdAt = new Date(sale.created_at);
    return createdAt >= start && createdAt < end;
  });
  const saleIds = new Set(periodSales.map((sale) => sale.id));
  const revenue = periodSales.reduce((total, sale) => total + Number(sale.net_total || 0), 0);
  const discounts = periodSales.reduce((total, sale) => total + Number(sale.discount || 0), 0);
  const pieces = saleItems.filter((item) => saleIds.has(item.sale_id))
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
  return { revenue, sales: periodSales.length, pieces, averageTicket: periodSales.length ? revenue / periodSales.length : 0, discounts };
}

function isSameDay(value, key) {
  return Boolean(value) && dateKey(new Date(value)) === key;
}

function isCurrentMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function sum(items, predicate, field = 'amount') {
  return items
    .filter(predicate)
    .reduce((total, item) => total + Number(item[field] || 0), 0);
}

function formatSaleNumber(sale) {
  const number = sale?.formatted_operation_number || String(sale?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `VD-${number}` : 'VD-00000';
}

function formatOrderNumber(order) {
  const number = order?.formatted_operation_number || String(order?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `PD-${number}` : 'PD-00000';
}

function getNoteSection(text, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`\\[${escaped}\\]\\n([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`));
  const value = match?.[1]?.trim() || '';
  return value === '-' ? '' : value;
}

function getExpenseSupplierName(expense, suppliers) {
  const supplier = suppliers.find((item) => item.id === expense?.supplier_id);
  return supplier?.name || getNoteSection(expense?.notes, 'Fornecedor') || expense?.description || 'Fornecedor não informado';
}

function getExpenseDueDate(expense) {
  return expense?.due_date || getNoteSection(expense?.notes, 'Vencimento') || expense?.expense_date || '';
}

function getExpenseStatus(expense) {
  if (expense?.deleted_at || expense?.status === 'cancelled') return 'cancelled';
  if (expense?.status === 'paid') return 'paid';
  if (expense?.financial_entry_id) return 'paid';
  return 'pending';
}

function getOrderTrackingCode(trackingRows, orderId) {
  return trackingRows
    .filter((item) => item.order_id === orderId)
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0]
    ?.tracking_code || '';
}

function buildLast30Days() {
  return Array.from({ length: 30 }, (_, index) => {
    const date = daysAgo(29 - index);
    return {
      key: dateKey(date),
      label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value: 0,
    };
  });
}

function getStockAlertRows(stockRows) {
  return (stockRows || [])
    .map((row) => ({
      productId: row.product_id,
      product: row.product_name,
      color: row.color_name || row.color || '-',
      size: row.size,
      quantity: Number(row.quantity || 0),
      minimumStock: Number(row.minimum_stock || 0),
      imageUrl: row.color_image_url || row.image_url || '',
    }))
    .filter((row) => row.quantity <= 0 || row.quantity <= row.minimumStock)
    .sort((a, b) => a.quantity - b.quantity || a.product.localeCompare(b.product));
}

function getProductImage(stockRows, productId) {
  return (stockRows || []).find((row) => row.product_id === productId && row.color_image_url)?.color_image_url || '';
}

function buildTopProducts(saleItems, stockRows = []) {
  const byProduct = new Map();
  (saleItems || []).forEach((item) => {
    const key = item.product_id || item.product_name;
    const current = byProduct.get(key) || {
      productId: item.product_id,
      name: item.product_name || 'Produto',
      quantity: 0,
      revenue: 0,
      imageUrl: getProductImage(stockRows, item.product_id),
    };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.subtotal ?? item.total ?? item.line_total ?? 0);
    byProduct.set(key, current);
  });
  return [...byProduct.values()]
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, 10);
}

function buildSalesChart(sales) {
  const days = buildLast30Days();
  const byDay = new Map(days.map((day) => [day.key, day]));
  (sales || [])
    .filter((sale) => sale.status !== 'cancelled')
    .forEach((sale) => {
      const day = byDay.get(dateKey(new Date(sale.created_at)));
      if (day) day.value += 1;
    });
  return days;
}

function buildRevenueChart(entries) {
  const days = buildLast30Days();
  const byDay = new Map(days.map((day) => [day.key, day]));
  (entries || [])
    .filter((entry) => entry.status === 'active' && entry.type === 'income')
    .forEach((entry) => {
      const day = byDay.get(dateKey(new Date(entry.created_at)));
      if (day) day.value += Number(entry.amount || 0);
    });
  return days;
}

function getMonthlyGoal(settingsRows = []) {
  const company = settingsRows.find((row) => row.key === 'company')?.value || {};
  return Number(company.monthly_goal || company.monthly_revenue_goal || 0);
}

function renderIcon(name) {
  const icons = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    package: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2zM4 6.5l8 4.5 8-4.5M12 11v9"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3zM12 9v5M12 17h.01"/></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h15l-2 8H8L6 3H3"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>',
    money: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M16 9c-.7-.8-1.9-1.2-3.4-1.2-1.9 0-3.2.9-3.2 2.3 0 3.5 6.7 1.6 6.7 5.4 0 1.4-1.4 2.3-3.4 2.3-1.6 0-2.9-.5-3.7-1.5"/></svg>',
    trend: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 10 11l4 4 6-8M15 7h5v5"/></svg>',
    order: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7a5 5 0 0 1 10 0M5 7h14l-1.2 13H6.2L5 7zM9 11h6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/></svg>',
    discount: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12 12 20 4 12V4h8l8 8Z"/><circle cx="9" cy="9" r="1"/></svg>',
  };
  return icons[name] || icons.chart;
}

function renderProductImage(src, alt) {
  if (src) {
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  }
  return '<span aria-hidden="true">VB</span>';
}

function renderLineChart(rows, formatter = (value) => value) {
  const width = 760;
  const height = 190;
  const padding = 22;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const points = rows.map((row, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(rows.length - 1, 1);
    const y = height - padding - (row.value / max) * (height - padding * 2);
    return { ...row, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: height - padding - ratio * (height - padding * 2),
    value: max * ratio,
  })).reverse();

  return `
    <div class="dashboard-line-chart" role="img" aria-label="Faturamento dos últimos 30 dias">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        ${ticks.map((tick) => `
          <line x1="${padding}" x2="${width - padding}" y1="${tick.y.toFixed(2)}" y2="${tick.y.toFixed(2)}"></line>
        `).join('')}
        <path class="dashboard-line-chart__area" d="${areaPath}"></path>
        <path class="dashboard-line-chart__line" d="${path}"></path>
        ${points.map((point) => `
          <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4">
            <title>${escapeHtml(`${point.label}: ${formatter(point.value)}`)}</title>
          </circle>
        `).join('')}
      </svg>
      <div class="dashboard-line-chart__axis">
        <span>${escapeHtml(rows[0]?.label || '')}</span>
        <span>${escapeHtml(rows[Math.floor(rows.length / 2)]?.label || '')}</span>
        <span>${escapeHtml(rows[rows.length - 1]?.label || '')}</span>
      </div>
    </div>
  `;
}

function getChartSummary(rows) {
  const total = rows.reduce((amount, row) => amount + Number(row.value || 0), 0);
  const highest = rows.reduce((max, row) => (Number(row.value || 0) > Number(max.value || 0) ? row : max), rows[0] || { value: 0 });
  const average = rows.length ? total / rows.length : 0;

  return { total, highest, average };
}

function renderRevenueChartCard(model) {
  const summary = getChartSummary(model.revenueChart);

  return `
    <article class="dashboard-card dashboard-chart-card">
      <div class="dashboard-card__header dashboard-card__header--chart">
        <h3>Faturamento - últimos 30 dias</h3>
        <div class="dashboard-chart-stats" aria-label="Resumo do faturamento">
          <span><strong>${escapeHtml(currency(summary.total))}</strong><small>Total no período</small></span>
          <span><strong>${escapeHtml(currency(summary.highest.value))}</strong><small>Maior dia</small></span>
          <span><strong>${escapeHtml(currency(summary.average))}</strong><small>Média diária</small></span>
        </div>
      </div>
      ${renderLineChart(model.revenueChart, currency)}
    </article>
  `;
}

function renderMonthlyGoal(model) {
  const goal = Number(model.monthlyGoal || 0);
  const realized = Number(model.revenueMonth || 0);
  const percent = goal > 0 ? Math.min(100, (realized / goal) * 100) : 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * percent) / 100;

  if (goal <= 0) {
    return `
      <article class="dashboard-card dashboard-goal-card dashboard-goal-card--empty">
        <div class="dashboard-card__header">
          <h3>Meta do mês</h3>
        </div>
        <div class="dashboard-goal-empty">
          <strong>Defina uma meta mensal em Configurações.</strong>
          <p>Acompanhe o percentual concluído assim que a meta da empresa estiver configurada.</p>
          <a href="#/configuracoes" class="dashboard-card__link">Abrir configurações</a>
        </div>
      </article>
    `;
  }

  return `
    <article class="dashboard-card dashboard-goal-card">
      <div class="dashboard-card__header">
        <h3>Meta do mês</h3>
        <span>${escapeHtml(new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</span>
      </div>
      <div class="dashboard-goal-card__body">
        <div>
          <p>Meta do mês</p>
          <strong>${escapeHtml(currency(goal))}</strong>
          <p>Realizado</p>
          <b>${escapeHtml(currency(realized))} / ${escapeHtml(currency(goal))}</b>
          <div class="dashboard-goal-card__bar" aria-hidden="true">
            <span style="width: ${percent.toFixed(2)}%"></span>
          </div>
        </div>
        <svg viewBox="0 0 120 120" role="img" aria-label="${percent.toFixed(2).replace('.', ',')}% concluído">
          <circle cx="60" cy="60" r="${radius}"></circle>
          <circle cx="60" cy="60" r="${radius}" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}"></circle>
          <text x="60" y="58">${percent.toFixed(2).replace('.', ',')}%</text>
          <text x="60" y="76">concluído</text>
        </svg>
      </div>
    </article>
  `;
}

function renderBarChart(rows, formatter = (value) => value) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return `
    <div class="dashboard-chart" role="img" aria-label="Gráfico dos últimos 30 dias">
      ${rows.map((row) => {
        const height = Math.max(4, Math.round((row.value / max) * 100));
        return `
          <div class="dashboard-chart__bar" title="${escapeHtml(`${row.label}: ${formatter(row.value)}`)}">
            <span style="height: ${height}%"></span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMetricCards(cards, className = '') {
  return `
    <div class="dashboard-kpi-grid ${className}">
      ${cards.map((card) => `
        <article class="dashboard-kpi-card">
          <div class="dashboard-kpi-card__icon">${renderIcon(card.icon || 'money')}</div>
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          ${card.hint ? `<small>${escapeHtml(card.hint)}</small>` : ''}
        </article>
      `).join('')}
    </div>
  `;
}

function renderDashboardMetricCard(card) {
  return `
    <article class="dashboard-v2-metric-card">
      <div class="dashboard-v2-metric-card__icon">${renderIcon(card.icon || 'money')}</div>
      <div class="dashboard-v2-metric-card__content">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small>${escapeHtml(card.hint || '')}</small>
      </div>
    </article>
  `;
}

function renderDashboardMetrics(model) {
  const cards = [
    { label: 'Vendas Hoje', value: String(model.salesToday), hint: `${model.salesToday} venda${model.salesToday === 1 ? '' : 's'} realizada${model.salesToday === 1 ? '' : 's'}`, icon: 'cart' },
    { label: 'Faturamento', value: currency(model.revenueToday), hint: 'Valor total de hoje', icon: 'money' },
    { label: 'Pedidos Online', value: String(model.awaitingShippingCount), hint: 'Aguardando envio', icon: 'package' },
    { label: 'Estoque Crítico', value: String(model.lowStockTotal), hint: 'Produtos com estoque baixo', icon: 'alert' },
  ];

  return `
    <div class="dashboard-v2-metrics" aria-label="Indicadores principais">
      ${cards.map((card) => renderDashboardMetricCard(card)).join('')}
    </div>
  `;
}

function renderDashboardHeader() {
  return `
    <header class="dashboard-v2-header">
      <div>
        <h1>Dashboard</h1>
        <p>Resumo da operação de hoje.</p>
      </div>
      <img src="${escapeHtml(getBrandLogoSrc('dark'))}" alt="Veste Bem" loading="eager" decoding="async">
    </header>
  `;
}

function renderDashboardPeriods(model) {
  return `
    <div class="dashboard-period-grid" aria-label="Faturamento por período">
      ${model.periods.map((period) => `
        <article class="dashboard-period-card">
          <header class="dashboard-period-card__header">
            <span class="dashboard-period-card__icon">${renderIcon('calendar')}</span>
            <strong>${escapeHtml(period.title)}</strong>
            <time>${escapeHtml(period.label)}</time>
          </header>
          <div class="dashboard-period-card__revenue"><strong>${escapeHtml(currency(period.summary.revenue))}</strong><span>Faturamento</span></div>
          <div class="dashboard-period-card__indicators">
            <div>${renderIcon('cart')}<strong>${period.summary.sales}</strong><span>Vendas</span></div>
            <div>${renderIcon('package')}<strong>${period.summary.pieces}</strong><span>Peças</span></div>
            <div>${renderIcon('money')}<strong>${escapeHtml(currency(period.summary.averageTicket))}</strong><span>Ticket médio</span></div>
            <div>${renderIcon('discount')}<strong>${escapeHtml(currency(period.summary.discounts))}</strong><span>Descontos</span></div>
          </div>
        </article>
      `).join('')}
    </div>`;
}

function renderDashboardAttention(model) {
  const alerts = model.attentionAlerts;
  const hasAlerts = alerts.length > 0;
  return `
    <section class="dashboard-attention" aria-labelledby="dashboard-attention-title">
      <header class="dashboard-attention__header">
        <span class="dashboard-attention__icon dashboard-attention__icon--${hasAlerts ? 'warning' : 'normal'}">${renderIcon(hasAlerts ? 'alert' : 'check')}</span>
        <div><h2 id="dashboard-attention-title">${hasAlerts ? 'Precisa da sua atenção' : 'Operação em dia'}</h2><p>${hasAlerts ? 'Revise os itens abaixo para manter a operação em dia.' : 'Nenhuma pendência exige sua atenção.'}</p></div>
      </header>
      ${hasAlerts ? `<div class="dashboard-attention__grid">${alerts.map((alert) => `
        <a class="dashboard-alert-card dashboard-alert-card--${escapeHtml(alert.tone)}" href="${escapeHtml(alert.href)}">
          <span class="dashboard-alert-card__icon">${renderIcon(alert.icon)}</span>
          <div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.description)}</p></div>
          <b>${escapeHtml(alert.action)} <span aria-hidden="true">›</span></b>
        </a>`).join('')}</div>` : ''}
    </section>`;
}

function renderDashboardOperation(model) {
  const alerts = [
    model.awaitingShippingCount > 0 ? { label: 'Pedidos online aguardando envio', value: model.awaitingShippingCount, href: '#/pedidos?status=awaiting_shipping' } : null,
    model.lowStockTotal > 0 ? { label: 'Estoque crítico', value: model.lowStockTotal, href: '#/estoque?status=low' } : null,
  ].filter(Boolean);
  const hasAlerts = alerts.length > 0;

  return `
    <section class="dashboard-v2-operation ${hasAlerts ? 'dashboard-v2-operation--alert' : 'dashboard-v2-operation--normal'}" aria-label="Resumo operacional">
      <div class="dashboard-v2-operation__body">
        <div class="dashboard-v2-operation__icon">${renderIcon(hasAlerts ? 'alert' : 'check')}</div>
        <div class="dashboard-v2-operation__content">
          <p class="dashboard-v2-eyebrow">${hasAlerts ? 'Atenção' : 'Operação normal'}</p>
          <h2>${hasAlerts ? 'Alguns pontos pedem atenção.' : 'Nenhuma pendência encontrada.'}</h2>
          <p>${hasAlerts ? 'Revise os itens abaixo para manter a operação fluindo sem atritos.' : 'Tudo certo para continuar vendendo!'}</p>
          ${hasAlerts ? `
            <div class="dashboard-v2-operation__list">
              ${alerts.map((alert) => `
                <a class="dashboard-v2-operation__item" href="${escapeHtml(alert.href)}">
                  <span>${escapeHtml(alert.label)}</span>
                  <strong>${escapeHtml(alert.value)}</strong>
                </a>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="dashboard-v2-operation__art" aria-hidden="true"><span></span></div>
    </section>
  `;
}

function renderDashboardQuickActions() {
  const actions = [
    { label: 'Nova Venda', detail: 'Iniciar uma nova venda', href: '#/vendas/nova', icon: 'cart' },
    { label: 'Novo Cliente', detail: 'Cadastrar cliente', href: '#/clientes', icon: 'order' },
    { label: 'Novo Produto', detail: 'Cadastrar produto', href: '#/produtos', icon: 'bag' },
    { label: 'Relatórios', detail: 'Ver relatórios', href: '#/relatorios', icon: 'chart' },
  ];

  return `
    <section class="dashboard-v2-quick" aria-label="Atalhos rápidos">
      <header class="dashboard-v2-section-head">
        <h3>Atalhos rápidos</h3>
      </header>
      <div class="dashboard-v2-quick-grid">
        ${actions.map((action) => `
          <a class="dashboard-v2-quick-card" href="${escapeHtml(action.href)}">
            <span class="dashboard-v2-quick-card__icon">${renderIcon(action.icon)}</span>
            <span class="dashboard-v2-quick-card__content">
              <strong>${escapeHtml(action.label)}</strong>
              <small>${escapeHtml(action.detail)}</small>
            </span>
            <span class="dashboard-v2-quick-card__arrow" aria-hidden="true">&rarr;</span>
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function renderDashboardFooter() {
  return '<footer class="dashboard-v2-footer">Veste Bem Admin • Gestão inteligente da sua loja</footer>';
}

function renderPendingItems(items) {
  const visibleItems = items.filter((item) => item.visible !== false);
  return `
    <article class="dashboard-card dashboard-card--attention">
      <div class="dashboard-card__header">
        <h3>Pendências operacionais</h3>
        <span>${visibleItems.reduce((total, item) => total + item.count, 0)}</span>
      </div>
      <div class="dashboard-pending-list">
        ${visibleItems.map((item) => `
          <a class="dashboard-pending-item" href="${escapeHtml(item.href)}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.count)}</strong>
          </a>
        `).join('')}
      </div>
    </article>
  `;
}

function renderOperationalSummary(model, admin) {
  const items = [
    { label: 'pedidos', detail: 'aguardando envio', value: model.awaitingShippingCount, icon: 'package', tone: 'dark' },
    { label: 'produtos', detail: 'com estoque baixo', value: model.lowStockTotal, icon: 'alert', tone: 'gold' },
    { label: 'vendas', detail: 'realizadas hoje', value: model.salesToday, icon: 'cart', tone: 'dark' },
    { label: 'faturamento de hoje', detail: admin ? '' : 'pelas vendas', value: currency(model.revenueToday), icon: 'money', tone: 'money' },
  ];

  return `
    <section class="dashboard-summary" aria-label="Resumo operacional de hoje">
      <div class="dashboard-summary__mark">${renderIcon('chart')}</div>
      <div class="dashboard-summary__content">
        <strong>Hoje você possui:</strong>
        ${items.map((item) => `
          <div class="dashboard-summary__item dashboard-summary__item--${escapeHtml(item.tone)}">
            <span class="dashboard-summary__icon">${renderIcon(item.icon)}</span>
            <p><b>${escapeHtml(item.value)}</b> ${escapeHtml(item.label)}${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderTopProducts(products) {
  return `
    <article class="dashboard-card dashboard-top-products">
      <div class="dashboard-card__header">
        <h3>Produtos mais vendidos</h3>
        <a href="#/relatorios?tab=products" class="dashboard-card__link">Ver relatório</a>
      </div>
      ${products.length ? `
        <ol class="dashboard-product-ranking">
          ${products.slice(0, 3).map((product, index) => `
            <li>
              <div class="dashboard-product-thumb">${renderProductImage(product.imageUrl, product.name)}</div>
              <span class="dashboard-product-rank">${index + 1}</span>
              <div>
                <strong>${escapeHtml(product.name)}</strong>
                <small>${escapeHtml(product.quantity)} vendidos</small>
                <b>${escapeHtml(currency(product.revenue))}</b>
              </div>
            </li>
          `).join('')}
        </ol>
      ` : '<p class="table-empty">Sem itens de venda disponíveis para este perfil.</p>'}
    </article>
  `;
}

function renderLatestSales(sales) {
  return `
    <article class="dashboard-card dashboard-list-card">
      <div class="dashboard-card__header">
        <h3>Últimas vendas</h3>
        <a href="#/vendas" class="dashboard-card__link">Ver todas</a>
      </div>
      <div class="dashboard-mini-list">
        ${sales.length ? sales.slice(0, 4).map((sale) => `
          <a class="dashboard-mini-row" href="#/vendas?sale=${escapeHtml(sale.id)}">
            <span class="dashboard-sale-main">
              <strong>${escapeHtml(sale.customer_name || '-')}</strong>
              <b>${escapeHtml(currency(sale.net_total))}</b>
              <em>${escapeHtml(paymentLabel(sale.payment_method))}</em>
            </span>
            <span class="dashboard-sale-meta">
              <small>${escapeHtml(formatTime(sale.created_at))}</small>
              <small>${escapeHtml(formatDate(sale.created_at))}</small>
              <small>${escapeHtml(formatSaleNumber(sale))}</small>
            </span>
          </a>
        `).join('') : '<p class="table-empty">Nenhuma venda encontrada.</p>'}
      </div>
    </article>
  `;
}

function renderAwaitingShipping(orders) {
  return `
    <article class="dashboard-card dashboard-list-card">
      <div class="dashboard-card__header">
        <h3>Pedidos aguardando envio</h3>
        <a href="#/pedidos?status=awaiting_shipping" class="dashboard-card__link">Ver todos</a>
      </div>
      <div class="dashboard-mini-list">
        ${orders.length ? orders.slice(0, 3).map((order) => `
          <a class="dashboard-mini-row dashboard-mini-row--order" href="#/pedidos?order=${escapeHtml(order.id)}">
            <strong>${escapeHtml(formatOrderNumber(order))}</strong>
            <span>${escapeHtml(order.customer_name || '-')}</span>
            <em>${escapeHtml(orderStatusLabels[order.order_status] || order.order_status)}</em>
          </a>
        `).join('') : '<p class="table-empty">Nenhum pedido aguardando envio.</p>'}
      </div>
    </article>
  `;
}

function renderLatestOrders(orders) {
  return `
    <article class="dashboard-card">
      <div class="dashboard-card__header">
        <h3>Últimos pedidos</h3>
      </div>
      <div class="table-shell">
        <table class="data-table dashboard-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Total</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${orders.length ? orders.map((order) => `
              <tr>
                <td data-label="Pedido"><strong>${escapeHtml(formatOrderNumber(order))}</strong></td>
                <td data-label="Cliente">${escapeHtml(order.customer_name || '-')}</td>
                <td data-label="Status"><span class="status-badge status-badge--info">${escapeHtml(orderStatusLabels[order.order_status] || order.order_status)}</span></td>
                <td data-label="Total">${escapeHtml(currency(order.total))}</td>
                <td data-label="Ação"><a class="button button--compact button--secondary" href="#/pedidos?order=${escapeHtml(order.id)}">Visualizar</a></td>
              </tr>
            `).join('') : '<tr><td colspan="5" class="table-empty">Nenhum pedido encontrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderStockAlerts(rows) {
  return `
    <article class="dashboard-card dashboard-list-card">
      <div class="dashboard-card__header">
        <h3>Estoque baixo</h3>
        <a href="#/estoque?status=low" class="dashboard-card__link">Ver todos</a>
      </div>
      ${rows.length ? `
        <div class="dashboard-stock-list">
          ${rows.slice(0, 3).map((row) => `
            <a class="dashboard-stock-row" href="#/estoque?status=low">
              <div class="dashboard-product-thumb">${renderProductImage(row.imageUrl, row.product)}</div>
              <span>
                <strong>${escapeHtml(row.product)}</strong>
                <small>${escapeHtml(row.color)} / ${escapeHtml(row.size)}</small>
              </span>
              <b>${escapeHtml(row.quantity)}<small>un.</small></b>
              <em class="dashboard-stock-badge dashboard-stock-badge--${row.quantity <= 0 ? 'critical' : 'low'}">${row.quantity <= 0 ? 'Crítico' : 'Baixo'}</em>
            </a>
          `).join('')}
        </div>
      ` : '<p class="table-empty">Nenhum alerta de estoque.</p>'}
    </article>
  `;
}

function renderExpenseLists({ dueSoon, overdue }) {
  return `
    <article class="dashboard-card">
      <div class="dashboard-card__header">
        <h3>Despesas a vencer</h3>
      </div>
      ${dueSoon.length ? `
        <div class="dashboard-alert-list">
          ${dueSoon.map((expense) => `
            <div class="dashboard-alert-row">
              <span><strong>${escapeHtml(expense.supplier)}</strong>${escapeHtml(currency(expense.amount))}</span>
              <small>${escapeHtml(formatDate(expense.dueDate))}</small>
            </div>
          `).join('')}
        </div>
      ` : '<p class="table-empty">Nenhuma despesa pendente próxima.</p>'}
    </article>
    <article class="dashboard-card dashboard-card--danger">
      <div class="dashboard-card__header">
        <h3>Despesas atrasadas</h3>
      </div>
      ${overdue.length ? `
        <div class="dashboard-alert-list">
          ${overdue.map((expense) => `
            <div class="dashboard-alert-row">
              <span><strong>${escapeHtml(expense.supplier)}</strong>${escapeHtml(currency(expense.amount))}</span>
              <small>${escapeHtml(expense.daysOverdue)} dia(s) em atraso</small>
            </div>
          `).join('')}
        </div>
      ` : '<p class="table-empty">Nenhuma despesa atrasada.</p>'}
    </article>
  `;
}

function renderFinancialSummary(monthIncome, monthExpense, receivableTotal) {
  return `
    <article class="dashboard-card">
      <div class="dashboard-card__header">
        <h3>Resumo financeiro</h3>
      </div>
      <div class="dashboard-financial-list">
        <div><span>Receitas do mês</span><strong>${escapeHtml(currency(monthIncome))}</strong></div>
        <div><span>Despesas do mês</span><strong>${escapeHtml(currency(monthExpense))}</strong></div>
        <div><span>Saldo do mês</span><strong>${escapeHtml(currency(monthIncome - monthExpense))}</strong></div>
        <div><span>A receber</span><strong>${escapeHtml(currency(receivableTotal))}</strong></div>
      </div>
    </article>
  `;
}

function normalizeOrders(orders, customers) {
  return (orders || []).map((order) => ({
    ...order,
    formatted_operation_number: String(order.operation_number || '').padStart(5, '0'),
    customer_name: customers.find((customer) => customer.id === order.customer_id)?.name || '-',
  }));
}

async function safeQuery(query, fallback = []) {
  const { data, error, count } = await query;
  if (error) {
    console.warn('Consulta do dashboard indisponível:', error.message);
    return { data: fallback, count: 0, error };
  }
  return { data: data || fallback, count: count || 0, error: null };
}

async function loadDashboardData(admin) {
  const monthStart = startOfMonth().toISOString();
  const last30 = daysAgo(29).toISOString();
  const fromDate = new Date(Math.min(new Date(monthStart).getTime(), new Date(last30).getTime())).toISOString();

  const baseQueries = [
    safeQuery(supabase.from('vw_sales_seller').select('id, operation_number, formatted_operation_number, customer_id, customer_name, gross_total, discount, net_total, payment_method, status, created_at').gte('created_at', fromDate).order('created_at', { ascending: false }).limit(5000)),
    safeQuery(supabase.from('orders').select('id, operation_number, customer_id, payment_status, order_status, total, created_at').order('created_at', { ascending: false }).limit(500)),
    safeQuery(supabase.from('customers').select('id, name, created_at').order('created_at', { ascending: false }).limit(1000)),
    safeQuery(supabase.from('vw_products_seller').select('id, name, status').order('name', { ascending: true })),
    safeQuery(supabase.from('vw_stock_seller').select('variation_id, product_id, product_name, color_name, color_image_url, size, quantity, minimum_stock, stock_status').order('quantity', { ascending: true })),
    safeQuery(supabase.from('settings').select('key, value').in('key', ['company'])),
  ];

  const [salesResult, ordersResult, customersResult, productsResult, stockResult, settingsResult] = await Promise.all(baseQueries);

  const sales = salesResult.data || [];
  const orders = normalizeOrders(ordersResult.data || [], customersResult.data || []);
  const orderIds = orders.map((order) => order.id);
  const saleIds = sales.map((sale) => sale.id);

  const [trackingResult, saleItemsResult] = await Promise.all([
    orderIds.length
      ? safeQuery(supabase.from('order_tracking').select('id, order_id, tracking_code, created_at, updated_at').in('order_id', orderIds))
      : Promise.resolve({ data: [] }),
    saleIds.length
      ? safeQuery(supabase.from('sale_items').select('id, sale_id, product_id, product_name, quantity, subtotal').in('sale_id', saleIds))
      : Promise.resolve({ data: [] }),
  ]);

  let financialEntries = [];
  let expenses = [];
  let suppliers = [];

  if (admin) {
    const [entriesResult, expensesResult, suppliersResult] = await Promise.all([
      safeQuery(supabase.from('financial_entries').select('id, type, amount, status, created_at').gte('created_at', fromDate).order('created_at', { ascending: false })),
      safeQuery(supabase.from('expenses').select('*').order('expense_date', { ascending: true })),
      safeQuery(supabase.from('suppliers').select('id, name')),
    ]);
    financialEntries = entriesResult.data || [];
    expenses = expensesResult.data || [];
    suppliers = suppliersResult.data || [];
  }

  return {
    sales,
    orders,
    customers: customersResult.data || [],
    products: productsResult.data || [],
    stockRows: stockResult.data || [],
    settingsRows: settingsResult.data || [],
    trackingRows: trackingResult.data || [],
    saleItems: saleItemsResult.data || [],
    financialEntries,
    expenses,
    suppliers,
  };
}

function buildDashboardModel(data, admin) {
  const today = dateKey(new Date());
  const completedSales = data.sales.filter((sale) => sale.status !== 'cancelled');
  const activeEntries = data.financialEntries.filter((entry) => entry.status === 'active');
  const incomeMonth = sum(activeEntries, (entry) => entry.type === 'income' && isCurrentMonth(entry.created_at));
  const expenseMonth = sum(activeEntries, (entry) => entry.type === 'expense' && isCurrentMonth(entry.created_at));
  const salesRevenueToday = completedSales
    .filter((sale) => isSameDay(sale.created_at, today))
    .reduce((total, sale) => total + Number(sale.net_total || 0), 0);
  const salesRevenueMonth = completedSales
    .filter((sale) => isCurrentMonth(sale.created_at))
    .reduce((total, sale) => total + Number(sale.net_total || 0), 0);
  const revenueTodayFromEntries = sum(activeEntries, (entry) => entry.type === 'income' && isSameDay(entry.created_at, today));
  const revenueToday = admin && activeEntries.length ? revenueTodayFromEntries : salesRevenueToday;
  const revenueMonth = admin && activeEntries.length ? incomeMonth : salesRevenueMonth;
  const salesToday = completedSales.filter((sale) => isSameDay(sale.created_at, today)).length;
  const ordersToday = data.orders.filter((order) => isSameDay(order.created_at, today)).length;
  const awaitingShippingOrders = data.orders.filter((order) => order.order_status === 'awaiting_shipping');
  const receivableTotal = data.orders
    .filter((order) => order.order_status === 'awaiting_payment' || order.payment_status === 'pending')
    .reduce((total, order) => total + Number(order.total || 0), 0);
  const stockAlerts = getStockAlertRows(data.stockRows);
  const outOfStock = stockAlerts.filter((row) => row.quantity <= 0).length;
  const lowStock = stockAlerts.filter((row) => row.quantity > 0 && row.quantity <= row.minimumStock).length;
  const todayDate = new Date(dateKey(new Date()));

  const pendingExpenses = data.expenses
    .filter((expense) => getExpenseStatus(expense) === 'pending')
    .map((expense) => {
      const dueDate = getExpenseDueDate(expense);
      const due = dueDate ? new Date(`${dueDate}T00:00:00`) : null;
      return {
        supplier: getExpenseSupplierName(expense, data.suppliers),
        amount: Number(expense.amount || 0),
        dueDate,
        due,
        daysOverdue: due ? Math.max(0, Math.floor((todayDate - due) / 86400000)) : 0,
      };
    })
    .filter((expense) => expense.due);

  const allOverdueExpenses = pendingExpenses
    .filter((expense) => expense.due < todayDate)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const overdueExpenses = allOverdueExpenses.slice(0, 8);

  const dueSoonExpenses = pendingExpenses
    .filter((expense) => expense.due >= todayDate)
    .sort((a, b) => a.due - b.due)
    .slice(0, 8);

  const shippedWithoutTracking = data.orders.filter((order) => (
    order.order_status === 'shipped' && !getOrderTrackingCode(data.trackingRows, order.id)
  )).length;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = addDays(todayStart, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const formatMonthYear = (date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const formatDayMonth = (date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  const dueToday = pendingExpenses.filter((expense) => expense.due >= todayStart && expense.due < tomorrowStart);
  const criticalProductCount = new Set(stockAlerts.filter((row) => row.quantity > 0).map((row) => row.productId)).size;
  const attentionAlerts = [
    admin && allOverdueExpenses.length ? { tone: 'danger', icon: 'alert', title: `${allOverdueExpenses.length} despesa${allOverdueExpenses.length === 1 ? '' : 's'} vencida${allOverdueExpenses.length === 1 ? '' : 's'}`, description: `Valor total ${currency(allOverdueExpenses.reduce((total, item) => total + item.amount, 0))}`, action: 'Ver financeiro', href: '#/financeiro?status=overdue' } : null,
    admin && dueToday.length ? { tone: 'warning', icon: 'calendar', title: `${dueToday.length} despesa${dueToday.length === 1 ? '' : 's'} vence${dueToday.length === 1 ? '' : 'm'} hoje`, description: `Valor total ${currency(dueToday.reduce((total, item) => total + item.amount, 0))}`, action: 'Ver financeiro', href: '#/financeiro?status=due_today' } : null,
    outOfStock ? { tone: 'danger', icon: 'package', title: `${outOfStock} variaç${outOfStock === 1 ? 'ão está' : 'ões estão'} sem estoque`, description: 'Produtos indisponíveis para venda.', action: 'Ver estoque', href: '#/estoque?status=out' } : null,
    criticalProductCount ? { tone: 'warning', icon: 'package', title: `${criticalProductCount} produto${criticalProductCount === 1 ? '' : 's'} com estoque crítico`, description: 'Estoque baixo, verifique reposição.', action: 'Ver estoque', href: '#/estoque?status=low' } : null,
    awaitingShippingOrders.length ? { tone: 'info', icon: 'order', title: `${awaitingShippingOrders.length} pedido${awaitingShippingOrders.length === 1 ? '' : 's'} aguardando envio`, description: 'Pedidos online pendentes.', action: 'Ver pedidos', href: '#/pedidos?status=awaiting_shipping' } : null,
  ].filter(Boolean);

  return {
    periods: [
      { title: 'Hoje', label: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), summary: summarizeSalesPeriod(completedSales, data.saleItems, todayStart, tomorrowStart) },
      { title: 'Esta semana', label: `${formatDayMonth(weekStart)} a ${formatDayMonth(addDays(weekEnd, -1))}`, summary: summarizeSalesPeriod(completedSales, data.saleItems, weekStart, weekEnd) },
      { title: 'Este mês', label: formatMonthYear(now), summary: summarizeSalesPeriod(completedSales, data.saleItems, monthStart, monthEnd) },
    ],
    attentionAlerts,
    cards: [
      { label: 'Faturamento Hoje', value: currency(revenueToday), hint: admin ? 'Receitas ativas' : 'Vendas realizadas', icon: 'money' },
      { label: 'Faturamento Mês', value: currency(revenueMonth), hint: admin ? 'Receitas do mês' : 'Vendas do mês', icon: 'trend' },
      { label: 'Vendas Hoje', value: String(salesToday), hint: `${ordersToday} pedido(s) hoje`, icon: 'cart' },
      { label: 'Pedidos Pendentes', value: String(awaitingShippingOrders.length), hint: 'aguardando envio', icon: 'package' },
      { label: 'Estoque Baixo', value: String(outOfStock + lowStock), hint: outOfStock ? `${outOfStock} sem estoque` : 'Requer atenção', icon: 'alert' },
    ],
    pendingItems: [
      { label: 'Pedidos aguardando pagamento', count: data.orders.filter((order) => order.order_status === 'awaiting_payment').length, href: '#/pedidos?status=awaiting_payment' },
      { label: 'Pedidos em separação', count: data.orders.filter((order) => order.order_status === 'in_separation').length, href: '#/pedidos?status=in_separation' },
      { label: 'Pedidos aguardando envio', count: data.orders.filter((order) => order.order_status === 'awaiting_shipping').length, href: '#/pedidos?status=awaiting_shipping' },
      { label: 'Pedidos enviados sem rastreio', count: shippedWithoutTracking, href: '#/pedidos?status=shipped&tracking=missing' },
      { label: 'Despesas vencidas', count: allOverdueExpenses.length, href: '#/financeiro?status=overdue', visible: admin },
      { label: 'Produtos sem estoque', count: outOfStock, href: '#/estoque?status=out' },
      { label: 'Produtos abaixo do estoque mínimo', count: lowStock, href: '#/estoque?status=low' },
    ],
    revenueChart: admin && activeEntries.length
      ? buildRevenueChart(data.financialEntries)
      : buildRevenueChart(completedSales.map((sale) => ({
        status: 'active',
        type: 'income',
        amount: sale.net_total,
        created_at: sale.created_at,
      }))),
    salesChart: buildSalesChart(data.sales),
    topProducts: buildTopProducts(data.saleItems, data.stockRows),
    latestSales: completedSales.slice(0, 10),
    latestOrders: data.orders.slice(0, 10),
    awaitingShippingOrders,
    stockAlerts,
    dueSoonExpenses,
    overdueExpenses,
    incomeMonth,
    expenseMonth,
    receivableTotal,
    revenueToday,
    revenueMonth,
    salesToday,
    awaitingShippingCount: awaitingShippingOrders.length,
    lowStockTotal: outOfStock + lowStock,
    monthlyGoal: getMonthlyGoal(data.settingsRows),
  };
}

function renderDashboardContent(container, route, model, admin) {
  container.innerHTML = `
    <section class="module-panel dashboard-module dashboard-v2" aria-label="Dashboard">
      ${renderDashboardHeader()}
      ${renderDashboardPeriods(model)}
      ${renderDashboardAttention(model)}
      ${renderDashboardQuickActions()}
    </section>
  `;
}

function renderDashboardError(container, message) {
  container.innerHTML = `
    <section class="module-panel dashboard-module dashboard-v2" aria-labelledby="dashboard-title">
      <p class="eyebrow">Dashboard</p>
      <h2 id="dashboard-title">Não foi possível carregar o painel</h2>
      <p class="module-panel__text">${escapeHtml(message)}</p>
    </section>
  `;
}

export async function renderDashboard(container, route, context = {}) {
  const requestId = ++dashboardRequestId;
  const admin = isAdmin(context.profile);

  container.innerHTML = `
    <section class="module-panel dashboard-module dashboard-v2" aria-labelledby="dashboard-title">
      ${renderDashboardHeader()}
      <div class="dashboard-period-grid">${Array.from({ length: 3 }, () => '<article class="dashboard-period-card dashboard-v2-skeleton"></article>').join('')}</div>
      <section class="dashboard-attention dashboard-v2-skeleton" aria-label="Carregando alertas"></section>
    </section>
  `;

  try {
    const data = await loadDashboardData(admin);
    if (requestId !== dashboardRequestId) return;
    const model = buildDashboardModel(data, admin);
    renderDashboardContent(container, route, model, admin);
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    if (requestId !== dashboardRequestId) return;
    renderDashboardError(container, error.message || 'Erro inesperado ao carregar indicadores.');
  }
}

