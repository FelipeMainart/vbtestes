import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';

const auditState = {
  profile: null,
  logs: [],
  users: [],
  selectedLog: null,
  filters: {
    dateFrom: '',
    dateTo: '',
    module: 'all',
    action: 'all',
    user: 'all',
    entity: 'all',
    search: '',
  },
  abortController: null,
};

const moduleLabels = {
  sales: 'Vendas',
  orders: 'Pedidos',
  products: 'Produtos',
  stock: 'Estoque',
  customers: 'Clientes',
  finance: 'Financeiro',
  reports: 'Relatórios',
  settings: 'Configurações',
};

const actionLabels = {
  create: 'Criado',
  update: 'Editado',
  delete: 'Excluído',
  cancel: 'Cancelado',
  pay: 'Pago',
  login: 'Login',
  logout: 'Logout',
  restore: 'Restaurado',
  mark_paid: 'Pago',
  update_status: 'Editado',
  update_tracking: 'Editado',
  manual_stock_entry: 'Criado',
  manual_stock_exit: 'Editado',
  manual_stock_adjustment: 'Editado',
};

const entityLabels = {
  sale: 'Venda',
  order: 'Pedido',
  product: 'Produto',
  product_variation: 'Variação',
  order_tracking: 'Rastreio',
  expense: 'Despesa',
  customer: 'Cliente',
  setting: 'Configuração',
};

const fieldLabels = {
  operation_number: 'Número operacional',
  gross_total: 'Valor bruto',
  net_total: 'Valor',
  total: 'Valor',
  discount: 'Desconto',
  status: 'Status',
  order_status: 'Status do pedido',
  payment_status: 'Status do pagamento',
  payment_method: 'Forma de pagamento',
  category: 'Categoria',
  description: 'Descrição',
  amount: 'Valor',
  paid_at: 'Data de pagamento',
  due_date: 'Vencimento',
  expense_date: 'Data da despesa',
  tracking_code: 'Código de rastreio',
  carrier: 'Transportadora',
  quantity: 'Quantidade',
  reason: 'Motivo',
  name: 'Nome',
};

const valueLabels = {
  completed: 'Concluída',
  cancelled: 'Cancelado',
  pending: 'Pendente',
  paid: 'Pago',
  awaiting_payment: 'Aguardando pagamento',
  in_separation: 'Em separação',
  awaiting_shipping: 'Aguardando envio',
  shipped: 'Enviado',
  delivered: 'Entregue',
  finalized: 'Finalizado',
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  bank_transfer: 'Transferência',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function dateKey(value) {
  if (!value) return '';
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

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function getModuleLabel(value) {
  return moduleLabels[value] || value || '-';
}

function getActionLabel(value) {
  return actionLabels[value] || value || '-';
}

function getEntityLabel(value) {
  return entityLabels[value] || value || '-';
}

function getUserName(log) {
  const user = auditState.users.find((item) => item.id === log.user_id);
  return user?.name || user?.role || log.user_role || 'Usuário';
}

function getPrimaryData(log) {
  return log.after_data || log.before_data || {};
}

function getNestedData(log) {
  const data = getPrimaryData(log);
  if (data.sale) return data.sale;
  if (data.order) return data.order;
  if (data.expense) return data.expense;
  if (data.product) return data.product;
  if (data.customer) return data.customer;
  return data;
}

function getOperationNumber(log) {
  const data = getNestedData(log);
  const number = data?.operation_number || data?.formatted_operation_number;
  if (!number) return '-';
  const padded = String(number).padStart(5, '0');
  if (log.entity_type === 'sale') return `VD-${padded}`;
  if (log.entity_type === 'order') return `PD-${padded}`;
  return padded;
}

function getEntityDisplay(log) {
  const operation = getOperationNumber(log);
  if (operation !== '-') return operation;
  const data = getNestedData(log);
  return data?.name || data?.description || data?.category || getEntityLabel(log.entity_type);
}

function getEntityName(log) {
  const data = getNestedData(log);
  return data?.name || data?.description || data?.category || getEntityDisplay(log);
}

function normalizeAction(action) {
  if (action === 'mark_paid') return 'pay';
  if (action === 'update_status' || action === 'update_tracking') return 'update';
  if (String(action || '').startsWith('manual_stock_')) return 'update';
  return action;
}

function getSummary(log) {
  const entity = getEntityLabel(log.entity_type);
  const display = getEntityDisplay(log);
  const name = getEntityName(log);

  if (log.module === 'sales' && log.action === 'create') return `Venda ${display} criada.`;
  if (log.module === 'sales' && log.action === 'cancel') return `Venda ${display} cancelada.`;
  if (log.module === 'sales' && log.action === 'update') return `Venda ${display} editada.`;
  if (log.module === 'orders' && log.action === 'mark_paid') return `Pedido ${display} marcado como pago.`;
  if (log.module === 'orders' && log.action === 'cancel') return `Pedido ${display} cancelado.`;
  if (log.module === 'orders' && log.action === 'update_status') return `Pedido ${display} atualizado.`;
  if (log.module === 'orders' && log.action === 'update_tracking') return `Rastreio do pedido ${display} atualizado.`;
  if (log.module === 'finance' && log.action === 'pay') return `Despesa ${name} paga.`;
  if (log.module === 'finance' && log.action === 'cancel') return `Despesa ${name} cancelada.`;
  if (log.module === 'stock') return `Estoque de ${name} atualizado.`;
  if (log.action === 'create') return `${entity} ${name} criado.`;
  if (log.action === 'update') return `${entity} ${name} editado.`;
  if (log.action === 'delete') return `${entity} ${name} excluído.`;
  if (log.action === 'restore') return `${entity} ${name} restaurado.`;
  return `${entity} ${name} ${getActionLabel(log.action).toLowerCase()}.`;
}

function getComparableData(data) {
  if (!data || typeof data !== 'object') return {};
  if (data.sale) return data.sale;
  if (data.order) return data.order;
  if (data.expense) return data.expense;
  if (data.product) return data.product;
  if (data.customer) return data.customer;
  return data;
}

function stableStringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  return JSON.stringify(value, Object.keys(value).sort());
}

function formatValue(value, field) {
  if (value === null || value === undefined || value === '') return '-';
  if (field && ['amount', 'gross_total', 'net_total', 'total', 'discount'].includes(field)) return currency(value);
  if (field && String(field).includes('date')) return formatDate(value);
  if (valueLabels[value]) return valueLabels[value];
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function getChangedFields(log) {
  const before = getComparableData(log.before_data);
  const after = getComparableData(log.after_data);
  if (!before || !after || !Object.keys(before).length || !Object.keys(after).length) return [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !['updated_at', 'created_at'].includes(key));

  return keys
    .filter((key) => stableStringify(before[key]) !== stableStringify(after[key]))
    .map((key) => ({
      field: key,
      label: fieldLabels[key] || key,
      before: formatValue(before[key], key),
      after: formatValue(after[key], key),
    }));
}

function getFilteredLogs() {
  return auditState.logs.filter((log) => {
    const logDate = dateKey(log.created_at);
    const action = normalizeAction(log.action);
    const entityText = `${log.entity_type || ''} ${getEntityDisplay(log)}`;
    const searchText = [
      formatDateTime(log.created_at),
      getUserName(log),
      getModuleLabel(log.module),
      getActionLabel(log.action),
      entityText,
      getSummary(log),
    ].join(' ');

    return (!auditState.filters.dateFrom || logDate >= auditState.filters.dateFrom)
      && (!auditState.filters.dateTo || logDate <= auditState.filters.dateTo)
      && (auditState.filters.module === 'all' || log.module === auditState.filters.module)
      && (auditState.filters.action === 'all' || action === auditState.filters.action)
      && (auditState.filters.user === 'all' || log.user_id === auditState.filters.user || log.user_role === auditState.filters.user)
      && (auditState.filters.entity === 'all' || normalize(entityText).includes(normalize(auditState.filters.entity)))
      && (!auditState.filters.search || normalize(searchText).includes(normalize(auditState.filters.search)));
  });
}

function renderSummaryCards(logs) {
  const cards = [
    ['Total de logs', logs.length],
    ['Criações', logs.filter((log) => normalizeAction(log.action) === 'create').length],
    ['Edições', logs.filter((log) => normalizeAction(log.action) === 'update').length],
    ['Cancelamentos', logs.filter((log) => normalizeAction(log.action) === 'cancel').length],
    ['Pagamentos', logs.filter((log) => normalizeAction(log.action) === 'pay').length],
  ];

  return `
    <div class="status-grid audit-summary-grid">
      ${cards.map(([label, value]) => `
        <article class="status-card audit-summary-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `).join('')}
    </div>
  `;
}

function renderFilters() {
  const moduleOptions = Object.entries(moduleLabels)
    .filter(([value]) => value !== 'reports')
    .map(([value, label]) => `<option value="${value}" ${auditState.filters.module === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
  const userOptions = auditState.users
    .map((user) => `<option value="${user.id}" ${auditState.filters.user === user.id ? 'selected' : ''}>${escapeHtml(user.name || user.role || 'Usuário')}</option>`)
    .join('');

  return `
    <form class="filters-bar audit-filters" data-audit-filters>
      <label class="form-field"><span>Período inicial</span><input name="dateFrom" type="date" value="${escapeHtml(auditState.filters.dateFrom)}" /></label>
      <label class="form-field"><span>Período final</span><input name="dateTo" type="date" value="${escapeHtml(auditState.filters.dateTo)}" /></label>
      <label class="form-field"><span>Módulo</span><select name="module"><option value="all">Todos</option>${moduleOptions}</select></label>
      <label class="form-field"><span>Ação</span><select name="action">
        <option value="all">Todas</option>
        <option value="create" ${auditState.filters.action === 'create' ? 'selected' : ''}>Criado</option>
        <option value="update" ${auditState.filters.action === 'update' ? 'selected' : ''}>Editado</option>
        <option value="delete" ${auditState.filters.action === 'delete' ? 'selected' : ''}>Excluído</option>
        <option value="cancel" ${auditState.filters.action === 'cancel' ? 'selected' : ''}>Cancelado</option>
        <option value="pay" ${auditState.filters.action === 'pay' ? 'selected' : ''}>Pago</option>
        <option value="login" ${auditState.filters.action === 'login' ? 'selected' : ''}>Login</option>
        <option value="logout" ${auditState.filters.action === 'logout' ? 'selected' : ''}>Logout</option>
        <option value="restore" ${auditState.filters.action === 'restore' ? 'selected' : ''}>Restaurado</option>
      </select></label>
      <label class="form-field"><span>Usuário</span><select name="user">
        <option value="all">Todos</option>
        <option value="admin" ${auditState.filters.user === 'admin' ? 'selected' : ''}>Administrador</option>
        <option value="seller" ${auditState.filters.user === 'seller' ? 'selected' : ''}>Vendedor</option>
        ${userOptions}
      </select></label>
      <label class="form-field"><span>Entidade</span><input name="entity" type="search" value="${auditState.filters.entity === 'all' ? '' : escapeHtml(auditState.filters.entity)}" placeholder="Venda, pedido, cliente..." /></label>
      <label class="form-field"><span>Busca livre</span><input name="search" type="search" value="${escapeHtml(auditState.filters.search)}" placeholder="Resumo, usuário, número..." /></label>
      <button class="button button--secondary" type="button" data-export-audit>Exportar CSV</button>
    </form>
  `;
}

function renderAuditTable(logs) {
  return `
    <div class="table-shell">
      <table class="data-table audit-table">
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Usuário</th>
            <th>Módulo</th>
            <th>Ação</th>
            <th>Entidade</th>
            <th>Número operacional</th>
            <th>Resumo</th>
          </tr>
        </thead>
        <tbody>
          ${logs.length ? logs.map((log) => `
            <tr class="audit-row" data-view-audit="${escapeHtml(log.id)}" tabindex="0">
              <td data-label="Data/Hora">${escapeHtml(formatDateTime(log.created_at))}</td>
              <td data-label="Usuário">${escapeHtml(getUserName(log))}</td>
              <td data-label="Módulo">${escapeHtml(getModuleLabel(log.module))}</td>
              <td data-label="Ação"><span class="status-badge status-badge--info">${escapeHtml(getActionLabel(log.action))}</span></td>
              <td data-label="Entidade">${escapeHtml(getEntityLabel(log.entity_type))}</td>
              <td data-label="Número operacional"><strong>${escapeHtml(getOperationNumber(log))}</strong></td>
              <td data-label="Resumo">${escapeHtml(getSummary(log))}</td>
            </tr>
          `).join('') : '<tr><td colspan="7" class="table-empty">Nenhum log encontrado.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderAuditList(container) {
  const logs = getFilteredLogs();
  container.querySelector('[data-audit-summary]').innerHTML = renderSummaryCards(logs);
  container.querySelector('[data-audit-list]').innerHTML = renderAuditTable(logs);
}

function renderDiff(log) {
  const changes = getChangedFields(log);
  if (!log.before_data || !log.after_data) {
    return '<p class="table-empty">Este registro não possui dados de antes e depois.</p>';
  }
  if (!changes.length) {
    return '<p class="table-empty">Nenhuma diferença relevante encontrada.</p>';
  }

  return `
    <div class="audit-diff-list">
      ${changes.map((change) => `
        <article class="audit-diff-item">
          <h4>${escapeHtml(change.label)}</h4>
          <div class="audit-diff-columns">
            <div>
              <span>Antes</span>
              <pre>${escapeHtml(change.before)}</pre>
            </div>
            <strong aria-hidden="true">↓</strong>
            <div>
              <span>Depois</span>
              <pre>${escapeHtml(change.after)}</pre>
            </div>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function openAuditModal(container, log) {
  auditState.selectedLog = log;
  const modal = container.querySelector('[data-audit-modal]');
  const body = container.querySelector('[data-audit-modal-body]');

  body.innerHTML = `
    <div class="audit-detail-grid">
      <div><span>Data</span><strong>${escapeHtml(formatDate(log.created_at))}</strong></div>
      <div><span>Hora</span><strong>${escapeHtml(formatTime(log.created_at))}</strong></div>
      <div><span>Usuário</span><strong>${escapeHtml(getUserName(log))}</strong></div>
      <div><span>Módulo</span><strong>${escapeHtml(getModuleLabel(log.module))}</strong></div>
      <div><span>Ação</span><strong>${escapeHtml(getActionLabel(log.action))}</strong></div>
      <div><span>Entidade</span><strong>${escapeHtml(getEntityDisplay(log))}</strong></div>
    </div>
    <article class="audit-detail-summary">
      <span>Resumo</span>
      <strong>${escapeHtml(getSummary(log))}</strong>
    </article>
    <section class="audit-detail-diff" aria-label="Antes e depois">
      <h3>Antes e depois</h3>
      ${renderDiff(log)}
    </section>
  `;

  modal.hidden = false;
}

function closeAuditModal(container) {
  container.querySelector('[data-audit-modal]').hidden = true;
  auditState.selectedLog = null;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportAuditCsv() {
  const rows = [
    ['Data', 'Usuário', 'Módulo', 'Ação', 'Entidade', 'Resumo'],
    ...getFilteredLogs().map((log) => [
      formatDateTime(log.created_at),
      getUserName(log),
      getModuleLabel(log.module),
      getActionLabel(log.action),
      getEntityDisplay(log),
      getSummary(log),
    ]),
  ];
  const content = rows.map((row) => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `auditoria-${todayKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadAuditData() {
  const [logsResult, usersResult] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, user_id, user_role, action, module, entity_type, entity_id, before_data, after_data, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('profiles')
      .select('id, name, role')
      .order('name', { ascending: true }),
  ]);

  if (logsResult.error) throw logsResult.error;
  if (usersResult.error) throw usersResult.error;

  auditState.logs = logsResult.data || [];
  auditState.users = usersResult.data || [];
}

function syncFilters(container) {
  const form = container.querySelector('[data-audit-filters]');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  auditState.filters = {
    dateFrom: data.dateFrom || '',
    dateTo: data.dateTo || '',
    module: data.module || 'all',
    action: data.action || 'all',
    user: data.user || 'all',
    entity: data.entity ? data.entity : 'all',
    search: data.search || '',
  };
  renderAuditList(container);
}

function bindAuditEvents(container) {
  const signal = auditState.abortController.signal;

  container.addEventListener('input', () => syncFilters(container), { signal });
  container.addEventListener('change', () => syncFilters(container), { signal });
  container.addEventListener('click', (event) => {
    const row = event.target.closest('[data-view-audit]');
    const closeButton = event.target.closest('[data-close-audit-modal]');
    const exportButton = event.target.closest('[data-export-audit]');

    if (closeButton) {
      closeAuditModal(container);
      return;
    }

    if (exportButton) {
      exportAuditCsv();
      return;
    }

    if (row) {
      const log = auditState.logs.find((item) => item.id === row.dataset.viewAudit);
      if (log) openAuditModal(container, log);
    }
  }, { signal });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const row = event.target.closest('[data-view-audit]');
    if (!row) return;
    const log = auditState.logs.find((item) => item.id === row.dataset.viewAudit);
    if (log) openAuditModal(container, log);
  }, { signal });
}

function renderShell(container, route) {
  container.innerHTML = `
    <section class="module-panel audit-module" aria-labelledby="audit-title">
      <div class="module-header">
        <div>
          <p class="eyebrow">${escapeHtml(route.label)}</p>
          <h2 id="audit-title">Auditoria</h2>
          <p class="module-panel__text">Histórico somente leitura das operações administrativas e transacionais.</p>
        </div>
      </div>
      <div data-audit-filters-area>${renderFilters()}</div>
      <div data-audit-summary>${renderSummaryCards([])}</div>
      <div data-audit-list><p class="table-empty">Carregando logs...</p></div>
    </section>

    <div class="modal-backdrop" data-audit-modal hidden>
      <section class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
        <div class="modal__header">
          <div>
            <p class="eyebrow">Auditoria</p>
            <h3 id="audit-modal-title">Detalhes do log</h3>
          </div>
          <button class="icon-button" type="button" data-close-audit-modal aria-label="Fechar">×</button>
        </div>
        <div data-audit-modal-body></div>
        <div class="modal__actions">
          <button class="button button--primary" type="button" data-close-audit-modal>Fechar</button>
        </div>
      </section>
    </div>
  `;
}

export async function renderAudit(container, route, context = {}) {
  auditState.abortController?.abort();
  auditState.abortController = new AbortController();
  auditState.profile = context.profile;
  auditState.selectedLog = null;
  auditState.logs = [];
  auditState.users = [];
  auditState.filters = {
    dateFrom: monthStartKey(),
    dateTo: todayKey(),
    module: 'all',
    action: 'all',
    user: 'all',
    entity: 'all',
    search: '',
  };

  if (!isAdmin(context.profile)) {
    container.innerHTML = `
      <section class="module-panel" aria-labelledby="audit-title">
        <p class="eyebrow">${escapeHtml(route.label)}</p>
        <h2 id="audit-title">Acesso restrito</h2>
        <p class="module-panel__text">Auditoria está disponível apenas para administradores.</p>
      </section>
    `;
    return;
  }

  renderShell(container, route);
  bindAuditEvents(container);

  try {
    await loadAuditData();
    container.querySelector('[data-audit-filters-area]').innerHTML = renderFilters();
    renderAuditList(container);
  } catch (error) {
    console.error('Erro ao carregar auditoria:', error);
    container.querySelector('[data-audit-list]').innerHTML = `<p class="table-empty">Não foi possível carregar auditoria: ${escapeHtml(error.message)}</p>`;
  }
}
