import { supabase } from '../supabaseClient.js';
import { bindPeriodSegmentedControl, renderPeriodSegmentedControl } from '../period.js';
import { isAdmin } from '../permissions.js';

const financeState = {
  profile: null,
  entries: [],
  expenses: [],
  suppliers: [],
  sales: [],
  orders: [],
  rows: [],
  editingExpense: null,
  selectedSupplier: null,
  supplierSearch: '',
  showSupplierForm: false,
  editingSupplier: null,
  payingExpense: null,
  supplierView: 'list',
  suppliersAvailable: true,
  monthlyGoal: 0,
  chartRange: '30',
  chartSeries: { income: true, expense: true },
  recentSearch: '',
  recentLimit: 8,
  abortController: null,
  filters: {
    dateFrom: '',
    dateTo: '',
    type: 'all',
    status: 'all',
    paymentMethod: 'all',
    origin: 'all',
  },
};

const typeLabels = {
  income: 'Receita',
  expense: 'Despesa',
  reversal: 'Reversão',
};

const statusLabels = {
  active: 'Pago',
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasada',
  cancelled: 'Cancelado',
};

const paymentLabels = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  bank_transfer: 'Transferência',
  other: 'Outro',
};

const originLabels = {
  sale: 'Venda',
  order: 'Pedido',
  expense: 'Despesa',
};

const expenseTypes = [
  'Compra de Mercadoria',
  'Marketing',
  'Frete',
  'Embalagens',
  'Impostos',
  'Energia',
  'Internet',
  'Aluguel',
  'Sistema/Software',
  'Equipamentos',
  'Manutenção',
  'Outros',
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

function financeIcon(name) {
  const icons = {
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h.01"/>',
    trendUp: '<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>',
    trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16h12a2 2 0 0 0 2-2V6Z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.1 7.7c.2-.4.4-.4.7-.4h.5l.8 2c.1.3 0 .5-.2.7l-.6.7c.8 1.6 1.9 2.7 3.6 3.4l.7-.8c.2-.2.4-.3.7-.2l2 .9c.3.1.4.4.4.7 0 1.1-.9 2-2 2-4.4 0-8-3.6-8-8 0-.4.2-.8.4-1Z"/>',
    location: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] || icons.wallet}</svg>`;
}

function showFinanceToast(message, tone = 'success') {
  if (window.vbAdminToast) window.vbAdminToast(message, tone);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function nullableText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function getNoteSection(text, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`\\[${escaped}\\]\\n([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`));
  const value = match?.[1]?.trim() || '';
  return value === '-' ? '' : value;
}

function getExpenseVisibleObservations(text) {
  const notes = String(text || '').trim();
  if (!notes) return '';

  const observations = getNoteSection(notes, 'Observações');
  if (observations) return observations;

  if (/\n?\[[^\]]+\]\n/.test(notes)) return '';

  return notes === '-' ? '' : notes;
}

function parseExpenseNotes(notes) {
  const text = String(notes || '').trim();
  return {
    supplier: getNoteSection(text, 'Fornecedor'),
    supplierId: getNoteSection(text, 'FornecedorId'),
    supplierDocument: getNoteSection(text, 'FornecedorDocumento'),
    supplierWhatsapp: getNoteSection(text, 'FornecedorWhatsApp'),
    dueDate: getNoteSection(text, 'Vencimento'),
    paidAt: getNoteSection(text, 'DataPagamento'),
    paidPaymentMethod: getNoteSection(text, 'FormaPagamentoRealizada'),
    paymentNotes: getNoteSection(text, 'ObservaçõesBaixa'),
    observations: getExpenseVisibleObservations(text),
  };
}

function buildExpenseNotes({ supplier, supplierId, supplierDocument, supplierWhatsapp, dueDate, paidAt, paidPaymentMethod, paymentNotes, observations }) {
  return [
    '[FornecedorId]',
    supplierId || '-',
    '',
    '[Fornecedor]',
    supplier || '-',
    '',
    '[FornecedorDocumento]',
    supplierDocument || '-',
    '',
    '[FornecedorWhatsApp]',
    supplierWhatsapp || '-',
    '',
    '[Vencimento]',
    dueDate || '-',
    '',
    '[DataPagamento]',
    paidAt || '-',
    '',
    '[FormaPagamentoRealizada]',
    paidPaymentMethod || '-',
    '',
    '[ObservaçõesBaixa]',
    paymentNotes || '-',
    '',
    '[Observações]',
    observations || '-',
  ].join('\n');
}

function parseNumber(value) {
  const raw = String(value || '0').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value, endOfDay = false) {
  if (!value) return null;
  const text = String(value);
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateOnly) return new Date(value);
  const [, year, month, day] = dateOnly;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
}

function formatDate(value) {
  if (!value) return '-';
  return parseLocalDate(value).toLocaleDateString('pt-BR');
}

function todayKey() {
  return dateKey();
}

function isPastDate(value) {
  return Boolean(value) && String(value).slice(0, 10) < todayKey();
}

function monthStartKey() {
  const now = new Date();
  return dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

function formatSaleNumber(sale) {
  const number = sale?.formatted_operation_number || String(sale?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `VD-${number}` : 'VD-00000';
}

function formatOrderNumber(order) {
  const number = order?.formatted_operation_number || String(order?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `PD-${number}` : 'PD-00000';
}

function getEntryExpense(entry) {
  return financeState.expenses.find((expense) => expense.financial_entry_id === entry.id || expense.id === entry.reference_id) || null;
}

function getSupplierName(supplier) {
  return supplier?.name || supplier?.supplier_name || '';
}

function getSupplierDocument(supplier) {
  return supplier?.document || supplier?.cpf_cnpj || supplier?.cnpj_cpf || '';
}

function getSupplierWhatsapp(supplier) {
  return supplier?.whatsapp || supplier?.phone || '';
}

function getSupplierCity(supplier) {
  return supplier?.city || '';
}

function getExpenseSupplier(expense) {
  const parsed = parseExpenseNotes(expense?.notes);
  return financeState.suppliers.find((supplier) => supplier.id === (expense?.supplier_id || parsed.supplierId)) || {
    id: parsed.supplierId,
    name: parsed.supplier,
    document: parsed.supplierDocument,
    whatsapp: parsed.supplierWhatsapp,
  };
}

function getReference(entry) {
  if (entry.reference_type === 'sale') {
    const sale = financeState.sales.find((item) => item.id === entry.reference_id);
    return sale ? formatSaleNumber(sale) : 'Venda';
  }

  if (entry.reference_type === 'order') {
    const order = financeState.orders.find((item) => item.id === entry.reference_id);
    return order ? formatOrderNumber(order) : 'Pedido';
  }

  return 'Despesa manual';
}

function getEntryPaymentMethod(entry, expense) {
  if (expense?.payment_method) return expense.payment_method;
  if (entry.reference_type === 'sale') {
    return financeState.sales.find((sale) => sale.id === entry.reference_id)?.payment_method || null;
  }
  if (entry.reference_type === 'order') {
    return financeState.orders.find((order) => order.id === entry.reference_id)?.payment_method || null;
  }
  return null;
}

function getExpenseDisplayDescription(expense, fallbackDescription) {
  const supplier = getSupplierName(getExpenseSupplier(expense));
  if (!supplier) return fallbackDescription;
  return fallbackDescription ? `${supplier} - ${fallbackDescription}` : supplier;
}

function getExpenseDueDate(expense) {
  return expense?.due_date || parseExpenseNotes(expense?.notes).dueDate || expense?.expense_date;
}

function getExpensePaidAt(expense) {
  return expense?.paid_at || parseExpenseNotes(expense?.notes).paidAt || '';
}

function getExpensePaymentMethod(expense) {
  return expense?.paid_payment_method || parseExpenseNotes(expense?.notes).paidPaymentMethod || expense?.payment_method || null;
}

function buildFinanceRows() {
  const rows = financeState.entries.map((entry) => {
    const expense = getEntryExpense(entry);
    const paymentMethod = getEntryPaymentMethod(entry, expense);
    return {
      id: entry.id,
      entry,
      expense,
      date: expense ? getExpenseDueDate(expense) : entry.created_at,
      type: entry.type,
      description: expense ? getExpenseDisplayDescription(expense, entry.description) : entry.description,
      category: entry.category,
      paymentMethod: expense ? getExpensePaymentMethod(expense) : paymentMethod,
      amount: Number(entry.amount || 0),
      status: expense ? getExpenseStatus(expense) : entry.status,
      origin: entry.reference_type || (entry.type === 'expense' ? 'expense' : 'manual'),
      reference: getReference(entry),
      editable: entry.reference_type === 'expense' || entry.origin === 'manual',
    };
  });

  financeState.expenses
    .filter((expense) => !expense.financial_entry_id)
    .forEach((expense) => {
      rows.push({
        id: expense.id,
        entry: null,
        expense,
        date: getExpenseDueDate(expense),
        type: 'expense',
        description: getExpenseDisplayDescription(expense, expense.description),
        category: expense.category,
        paymentMethod: getExpensePaymentMethod(expense),
        amount: Number(expense.amount || 0),
        status: getExpenseStatus(expense),
        origin: 'expense',
        reference: 'Despesa manual',
        editable: true,
      });
    });

  return rows.sort((a, b) => parseLocalDate(b.date)?.getTime() - parseLocalDate(a.date)?.getTime());
}

function getFilteredRows() {
  const dateFrom = parseLocalDate(financeState.filters.dateFrom);
  const dateTo = parseLocalDate(financeState.filters.dateTo, true);

  return financeState.rows.filter((row) => {
    const rowDate = parseLocalDate(row.date);
    const type = row.type === 'income' ? 'income' : 'expense';
    const matchesFrom = !dateFrom || (rowDate && rowDate >= dateFrom);
    const matchesTo = !dateTo || (rowDate && rowDate <= dateTo);
    const matchesType = financeState.filters.type === 'all' || financeState.filters.type === type;
    const matchesStatus = financeState.filters.status === 'all'
      || financeState.filters.status === row.status
      || (financeState.filters.status === 'active' && row.status === 'paid');
    const matchesPayment = financeState.filters.paymentMethod === 'all' || financeState.filters.paymentMethod === (row.paymentMethod || 'none');
    const matchesOrigin = financeState.filters.origin === 'all' || financeState.filters.origin === row.origin;
    return matchesFrom && matchesTo && matchesType && matchesStatus && matchesPayment && matchesOrigin;
  });
}

function sumRows(rows, predicate) {
  return rows.filter(predicate).reduce((total, row) => total + row.amount, 0);
}

function getRowsInSelectedPeriod(rows = financeState.rows) {
  const from = parseLocalDate(financeState.filters.dateFrom);
  const to = parseLocalDate(financeState.filters.dateTo, true);
  return rows.filter((row) => {
    const date = parseLocalDate(row.date);
    return (!from || (date && date >= from)) && (!to || (date && date <= to));
  });
}

function getMonthlyGoal(settingsRows = []) {
  const company = settingsRows.find((row) => row.key === 'company')?.value || {};
  return Number(company.monthly_goal || company.monthly_revenue_goal || 0);
}

async function loadFinanceData(container) {
  setFinanceLoading(container);

  try {
    const [entriesResult, expensesResult, salesResult, ordersResult, settingsResult] = await Promise.all([
      supabase.from('financial_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('sales').select('id, operation_number, payment_method, created_at'),
      supabase.from('orders').select('id, operation_number, payment_method, created_at'),
      supabase.from('settings').select('key, value').in('key', ['company']),
    ]);

    if (entriesResult.error) throw entriesResult.error;
    if (expensesResult.error) throw expensesResult.error;
    if (salesResult.error) throw salesResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (settingsResult.error) {
      console.warn('Meta mensal indisponível no financeiro:', settingsResult.error.message);
    }

    financeState.entries = entriesResult.data || [];
    financeState.expenses = expensesResult.data || [];
    financeState.monthlyGoal = settingsResult.error ? 0 : getMonthlyGoal(settingsResult.data || []);
    const suppliersResult = await supabase.from('suppliers').select('*').order('name', { ascending: true });
    if (suppliersResult.error) {
      financeState.suppliers = [];
      financeState.suppliersAvailable = false;
    } else {
      financeState.suppliers = suppliersResult.data || [];
      financeState.suppliersAvailable = true;
    }
    financeState.sales = (salesResult.data || []).map((sale) => ({
      ...sale,
      formatted_operation_number: String(sale.operation_number || '').padStart(5, '0'),
    }));
    financeState.orders = (ordersResult.data || []).map((order) => ({
      ...order,
      formatted_operation_number: String(order.operation_number || '').padStart(5, '0'),
    }));
    financeState.rows = buildFinanceRows();

    renderSummaryCards(container);
    renderFinanceGoal(container);
    renderFinanceList(container);
  } catch (error) {
    console.error('Erro ao carregar financeiro:', error);
    setFinanceError(container, `Não foi possível carregar o financeiro: ${error.message}`);
  }
}

function renderFinanceLayout(container, route) {
  container.innerHTML = `
    <section class="module-panel finance-module finance-overview" aria-labelledby="finance-title">
      <div class="module-header finance-overview__header">
        <div>
          <h2 id="finance-title">Financeiro</h2>
          <p class="module-panel__text">Acompanhe a saúde financeira da loja e antecipe decisões.</p>
        </div>
        <div class="module-header__actions">
          ${renderPeriodSegmentedControl({ id: 'finance', value: 'month' })}
          <button class="button button--secondary" type="button" data-manage-suppliers>${financeIcon('users')} Fornecedores</button>
          <button class="button finance-primary-action" type="button" data-new-expense>${financeIcon('plus')} Nova movimentação</button>
        </div>
      </div>

      <div class="finance-kpi-grid" data-finance-summary></div>
      <div class="finance-insights-grid">
        <article class="finance-panel finance-cashflow" data-finance-chart></article>
        <article class="finance-panel finance-attention" data-finance-attention></article>
      </div>
      <div class="finance-operational-grid" data-finance-goal></div>

      <section class="finance-panel finance-recent">
        <div class="finance-recent__header">
          <h3>Movimentações recentes</h3>
          <div class="finance-recent__tools">
            <label class="finance-search">${financeIcon('search')}<input type="search" placeholder="Buscar descrição, categoria ou referência" data-finance-search></label>
            <button class="button button--secondary" type="button" data-finance-filter-toggle>${financeIcon('filter')} Filtros</button>
            <button class="finance-link-button" type="button" data-finance-show-all>Ver todas as movimentações</button>
          </div>
        </div>
      <form class="filters-bar filters-bar--finance finance-advanced-filters" data-finance-filters hidden>
        <label class="form-field">
          <span>De</span>
          <input type="date" name="date_from" />
        </label>
        <label class="form-field">
          <span>Até</span>
          <input type="date" name="date_to" />
        </label>
        <label class="form-field">
          <span>Tipo</span>
          <select name="type">
            <option value="all">Todos</option>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>
        </label>
        <label class="form-field">
          <span>Status</span>
          <select name="status">
            <option value="all">Todos</option>
            <option value="active">Pago</option>
            <option value="pending">Pendente</option>
            <option value="overdue">Atrasada</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <label class="form-field">
          <span>Forma de pagamento</span>
          <select name="payment_method">
            <option value="all">Todas</option>
            <option value="pix">Pix</option>
            <option value="cash">Dinheiro</option>
            <option value="card">Cartão</option>
            <option value="bank_transfer">Transferência</option>
            <option value="other">Outro</option>
            <option value="none">Não informado</option>
          </select>
        </label>
        <label class="form-field">
          <span>Origem</span>
          <select name="origin">
            <option value="all">Todas</option>
            <option value="sale">Venda</option>
            <option value="order">Pedido</option>
            <option value="expense">Despesa</option>
          </select>
        </label>
      </form>

      <div data-finance-list>
        <p class="table-empty">Carregando financeiro...</p>
      </div>
      </section>
    </section>

    ${renderExpenseModal()}
    ${renderPayExpenseModal()}
    ${renderSupplierManagerModal()}
  `;
}

function renderExpenseModal() {
  const typeOptions = expenseTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');

  return `
    <div class="ds-drawer-backdrop finance-drawer-backdrop finance-movement-backdrop" data-expense-modal hidden>
      <section class="ds-drawer sale-drawer finance-drawer finance-expense-modal finance-movement-drawer is-open" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
        <form data-expense-form>
          <div class="modal__header">
            <div>
              <p class="eyebrow">Financeiro</p>
              <h3 id="expense-modal-title">Nova movimentação</h3>
              <p class="finance-drawer-subtitle">Registre uma nova despesa ou receita financeira.</p>
            </div>
            <button class="icon-button" type="button" data-close-expense-modal aria-label="Fechar">×</button>
          </div>
          <div class="form-grid">
            <div class="form-field form-field--full finance-movement-type">
              <span>Tipo de movimentação</span>
              <select name="movement_type" required hidden>
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
              <div class="finance-movement-type__options">
                <button class="is-active is-expense" type="button" data-movement-type-choice="expense"><span>${financeIcon('trendDown')}</span><div><strong>Despesa</strong><small>Saída de dinheiro</small></div><i>${financeIcon('check')}</i></button>
                <button class="is-income" type="button" data-movement-type-choice="income"><span>${financeIcon('trendUp')}</span><div><strong>Receita</strong><small>Entrada de dinheiro</small></div><i>${financeIcon('check')}</i></button>
              </div>
            </div>
            <div class="form-field form-field--full" data-expense-supplier-field>
              <div class="sale-section-header">
                <span>Fornecedor</span>
                <button class="button button--compact button--secondary" type="button" data-toggle-supplier-form>Novo Fornecedor</button>
              </div>
              <div data-expense-supplier-area></div>
            </div>
            <label class="form-field">
              <span data-finance-category-label>Categoria da despesa</span>
              <select name="category" required>
                <option value="">Selecione</option>
                ${typeOptions}
              </select>
            </label>
            <label class="form-field">
              <span>Descrição</span>
              <input name="description" type="text" placeholder="Descreva a movimentação" />
            </label>
            <label class="form-field">
              <span>Valor</span>
              <input name="amount" type="number" min="0" step="0.01" placeholder="R$ 0,00" required />
            </label>
            <label class="form-field">
              <span>Forma de pagamento prevista</span>
              <select name="payment_method">
                <option value="pix">Pix</option>
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão</option>
                <option value="bank_transfer">Transferência</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <label class="form-field">
              <span>Data da compra</span>
              <input name="expense_date" type="date" required />
            </label>
            <label class="form-field">
              <span>Data de vencimento</span>
              <input name="due_date" type="date" required />
            </label>
            <label class="form-field">
              <span>Status</span>
              <select name="expense_status">
                <option value="pending">Pendente</option>
                <option value="active">Pago</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <label class="form-field form-field--full">
              <span>Observações <small>(opcional)</small></span>
              <span class="finance-notes-wrap"><textarea name="notes" rows="4" maxlength="300" placeholder="Adicione observações sobre esta movimentação"></textarea><small data-finance-notes-count>0/300</small></span>
            </label>
          </div>
          <p class="form-message" data-expense-message></p>
          <div class="modal__actions">
            <button class="button button--danger" type="button" data-cancel-expense hidden>Cancelar despesa</button>
            <button class="button button--secondary" type="button" data-close-expense-modal>${financeIcon('close')} Cancelar</button>
            <button class="button button--primary" type="button" data-open-pay-expense hidden>Dar baixa</button>
            <button class="button finance-primary-action" type="submit" data-save-movement>${financeIcon('check')} Salvar movimentação</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderPayExpenseModal() {
  return `
    <div class="ds-drawer-backdrop finance-drawer-backdrop" data-pay-expense-modal hidden>
      <section class="ds-drawer sale-drawer finance-drawer is-open" role="dialog" aria-modal="true" aria-labelledby="pay-expense-title">
        <form data-pay-expense-form>
          <div class="modal__header">
            <div>
              <p class="eyebrow">Financeiro</p>
              <h3 id="pay-expense-title">Baixa de despesa</h3>
            </div>
            <button class="icon-button" type="button" data-close-pay-expense aria-label="Fechar">×</button>
          </div>
          <div data-pay-expense-summary></div>
          <div class="form-grid">
            <label class="form-field">
              <span>Data de pagamento</span>
              <input name="paid_at" type="date" required />
            </label>
            <label class="form-field">
              <span>Forma de pagamento realizada</span>
              <select name="paid_payment_method" required>
                <option value="pix">Pix</option>
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão</option>
                <option value="bank_transfer">Transferência</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <label class="form-field form-field--full">
              <span>Observações da baixa</span>
              <textarea name="payment_notes" rows="3"></textarea>
            </label>
          </div>
          <p class="form-message" data-pay-expense-message></p>
          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-close-pay-expense>Voltar</button>
            <button class="button button--primary" type="submit">Confirmar baixa</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderSupplierManagerModal() {
  return `
    <div class="ds-drawer-backdrop finance-drawer-backdrop" data-supplier-manager-modal hidden>
      <section class="ds-drawer sale-drawer finance-drawer finance-supplier-drawer is-open" role="dialog" aria-modal="true" aria-labelledby="supplier-manager-title">
        <div class="sale-drawer__body">
        <div class="finance-drawer-screen" data-supplier-list-screen>
          <div class="finance-drawer-header">
            <div><p class="eyebrow">Financeiro</p><h3 id="supplier-manager-title">Fornecedores</h3><p>Cadastre e mantenha os parceiros financeiros da loja.</p></div>
            <button class="sale-view-close" type="button" data-close-supplier-manager aria-label="Fechar">×</button>
          </div>
          <div class="finance-supplier-toolbar">
            <label class="finance-search">${financeIcon('search')}<input type="search" placeholder="Nome, WhatsApp ou CNPJ/CPF" data-supplier-manager-search /></label>
            <button class="button finance-primary-action" type="button" data-new-supplier-editor>${financeIcon('plus')} Novo fornecedor</button>
          </div>
          <div class="finance-supplier-manager">
          <div data-supplier-manager-list></div>
          </div>
          <footer class="finance-supplier-footer">
            <span class="finance-supplier-footer__icon">${financeIcon('info')}</span>
            <div><strong>Organize seus fornecedores</strong><p>Mantenha os dados sempre atualizados para facilitar suas compras e pagamentos.</p></div>
            <button class="button button--secondary" type="button" data-export-suppliers>${financeIcon('download')} Exportar lista</button>
          </footer>
        </div>
        <div class="finance-drawer-screen" data-supplier-editor-screen hidden>
          <div class="finance-drawer-header">
            <div class="finance-drawer-header__with-back"><button class="finance-drawer-back" type="button" data-back-supplier-list aria-label="Voltar">←</button><div><p class="eyebrow">Financeiro</p><h3 data-supplier-editor-title>Novo fornecedor</h3><p>Preencha os dados de identificação e contato.</p></div></div>
            <button class="sale-view-close" type="button" data-close-supplier-manager aria-label="Fechar">×</button>
          </div>
          <form class="finance-supplier-editor" data-supplier-editor-form>
            <div class="form-grid">
              <label class="form-field form-field--full">
                <span>Nome</span>
                <input name="name" type="text" required />
              </label>
              <label class="form-field">
                <span>CNPJ/CPF opcional</span>
                <input name="document" type="text" />
              </label>
              <label class="form-field">
                <span>WhatsApp</span>
                <input name="whatsapp" type="text" />
              </label>
              <label class="form-field">
                <span>E-mail</span>
                <input name="email" type="email" />
              </label>
              <label class="form-field">
                <span>Cidade</span>
                <input name="city" type="text" />
              </label>
              <label class="form-field form-field--full">
                <span>Observações</span>
                <textarea name="notes" rows="3"></textarea>
              </label>
            </div>
            <p class="form-message" data-supplier-editor-message></p>
            <div class="modal__actions">
              <button class="button button--secondary" type="button" data-back-supplier-list>${financeIcon('close')} Cancelar</button>
              <button class="button finance-primary-action" type="submit" data-save-supplier-editor hidden>${financeIcon('check')} Salvar fornecedor</button>
            </div>
          </form>
        </div>
        </div>
      </section>
    </div>
  `;
}

function setFinanceLoading(container) {
  const list = container.querySelector('[data-finance-list]');
  if (list) list.innerHTML = '<p class="table-empty">Carregando financeiro...</p>';
}

function setFinanceError(container, message) {
  const list = container.querySelector('[data-finance-list]');
  if (list) list.innerHTML = `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function getSupplierSuggestions() {
  const search = normalize(financeState.supplierSearch);
  const digits = search.replace(/\D/g, '');
  if (!search) return [];

  return financeState.suppliers
    .filter((supplier) => {
      const document = getSupplierDocument(supplier);
      const whatsapp = getSupplierWhatsapp(supplier);
      return normalize(getSupplierName(supplier)).includes(search)
        || normalize(document).includes(search)
        || normalize(whatsapp).includes(search)
        || (digits && String(document || '').replace(/\D/g, '').includes(digits))
        || (digits && String(whatsapp || '').replace(/\D/g, '').includes(digits));
    })
    .slice(0, 6);
}

function renderSupplierArea(container) {
  const area = container.querySelector('[data-expense-supplier-area]');
  if (!area) return;

  if (!financeState.suppliersAvailable) {
    area.innerHTML = `
      <div class="finance-setup-warning">
        Cadastro de fornecedores depende da proposta SQL de fornecedores e baixa de despesas.
      </div>
    `;
    return;
  }

  if (financeState.showSupplierForm) {
    area.innerHTML = renderInlineSupplierForm();
    return;
  }

  const supplier = financeState.selectedSupplier;
  const suggestions = getSupplierSuggestions();

  area.innerHTML = supplier ? `
    <article class="sale-selected-customer finance-selected-supplier">
      <span>Fornecedor Selecionado</span>
      <strong>${escapeHtml(getSupplierName(supplier))}</strong>
      <small>WhatsApp: ${escapeHtml(getSupplierWhatsapp(supplier) || '-')}</small>
      <small>CNPJ/CPF: ${escapeHtml(getSupplierDocument(supplier) || '-')}</small>
      <small>Cidade: ${escapeHtml(getSupplierCity(supplier) || '-')}</small>
      <button class="button button--compact button--secondary" type="button" data-clear-expense-supplier>Trocar fornecedor</button>
    </article>
  ` : `
    <label class="form-field">
      <span>Buscar fornecedor</span>
      <input name="supplier_search" type="search" value="${escapeHtml(financeState.supplierSearch)}" placeholder="Nome, WhatsApp ou CNPJ/CPF" autocomplete="off" data-expense-supplier-search />
    </label>
    <div class="sale-customer-results finance-supplier-results">
      ${suggestions.length ? suggestions.map((item) => `
        <button class="sale-customer-result finance-supplier-result" type="button" data-select-expense-supplier="${item.id}">
          <strong>${escapeHtml(getSupplierName(item))}</strong>
          <span>WhatsApp: ${escapeHtml(getSupplierWhatsapp(item) || '-')}</span>
          <span>CNPJ/CPF: ${escapeHtml(getSupplierDocument(item) || '-')}</span>
          <span>Cidade: ${escapeHtml(getSupplierCity(item) || '-')}</span>
        </button>
      `).join('') : `
        <p class="muted-text">Digite para buscar ou cadastre um novo fornecedor.</p>
      `}
    </div>
  `;
}

function renderInlineSupplierForm() {
  return `
    <div class="sale-inline-customer-form finance-inline-supplier-form">
      <div class="sale-section-header">
        <h5>Novo fornecedor</h5>
        <button class="button button--compact button--secondary" type="button" data-cancel-supplier-form>Cancelar</button>
      </div>
      <div class="form-grid">
        <label class="form-field form-field--full">
          <span>Nome</span>
          <input name="new_supplier_name" type="text" required />
        </label>
        <label class="form-field">
          <span>CNPJ/CPF opcional</span>
          <input name="new_supplier_document" type="text" />
        </label>
        <label class="form-field">
          <span>WhatsApp</span>
          <input name="new_supplier_whatsapp" type="text" />
        </label>
        <label class="form-field">
          <span>E-mail</span>
          <input name="new_supplier_email" type="email" />
        </label>
        <label class="form-field">
          <span>Cidade</span>
          <input name="new_supplier_city" type="text" />
        </label>
        <label class="form-field form-field--full">
          <span>Observações</span>
          <textarea name="new_supplier_notes" rows="3"></textarea>
        </label>
      </div>
      <button class="button button--primary" type="button" data-save-supplier>Salvar fornecedor</button>
    </div>
  `;
}

function openSupplierManager(container) {
  const modal = container.querySelector('[data-supplier-manager-modal]');
  const message = container.querySelector('[data-supplier-editor-message]');
  if (message) message.textContent = '';
  financeState.editingSupplier = null;
  financeState.supplierView = 'list';
  resetSupplierEditor(container);
  renderSupplierManagerList(container);
  setSupplierManagerView(container, 'list');
  modal.hidden = false;
}

function closeSupplierManager(container) {
  container.querySelector('[data-supplier-manager-modal]').hidden = true;
  financeState.editingSupplier = null;
  financeState.supplierView = 'list';
}

function setSupplierManagerView(container, view) {
  financeState.supplierView = view;
  const listScreen = container.querySelector('[data-supplier-list-screen]');
  const editorScreen = container.querySelector('[data-supplier-editor-screen]');
  if (listScreen) listScreen.hidden = view !== 'list';
  if (editorScreen) editorScreen.hidden = view !== 'editor';
  if (view === 'editor') container.querySelector('[data-supplier-editor-form] input[name="name"]')?.focus();
}

function resetSupplierEditor(container) {
  const form = container.querySelector('[data-supplier-editor-form]');
  const title = container.querySelector('[data-supplier-editor-title]');
  if (!form) return;
  form.reset();
  if (title) title.textContent = financeState.editingSupplier ? 'Editar fornecedor' : 'Novo fornecedor';

  const supplier = financeState.editingSupplier;
  if (supplier) {
    form.elements.name.value = getSupplierName(supplier);
    form.elements.document.value = getSupplierDocument(supplier);
    form.elements.whatsapp.value = getSupplierWhatsapp(supplier);
    form.elements.email.value = supplier.email || '';
    form.elements.city.value = getSupplierCity(supplier);
    form.elements.notes.value = supplier.notes || '';
  }
  updateSupplierSaveState(container);
}

function updateSupplierSaveState(container) {
  const form = container.querySelector('[data-supplier-editor-form]');
  const button = container.querySelector('[data-save-supplier-editor]');
  if (!form || !button) return;
  button.hidden = !nullableText(form.elements.name.value);
}

function renderSupplierManagerList(container) {
  const target = container.querySelector('[data-supplier-manager-list]');
  const input = container.querySelector('[data-supplier-manager-search]');
  if (!target) return;

  if (!financeState.suppliersAvailable) {
    target.innerHTML = '<p class="table-empty">Cadastro de fornecedores depende da proposta SQL ainda não aplicada.</p>';
    return;
  }

  const search = normalize(input?.value || '');
  const digits = search.replace(/\D/g, '');
  const suppliers = financeState.suppliers.filter((supplier) => {
    if (!search) return true;
    const document = getSupplierDocument(supplier);
    const whatsapp = getSupplierWhatsapp(supplier);
    return normalize(getSupplierName(supplier)).includes(search)
      || normalize(document).includes(search)
      || normalize(whatsapp).includes(search)
      || (digits && String(document || '').replace(/\D/g, '').includes(digits))
      || (digits && String(whatsapp || '').replace(/\D/g, '').includes(digits));
  });

  target.innerHTML = suppliers.length ? `
    <div class="finance-supplier-results">
      ${suppliers.map((supplier) => `
        <button class="finance-supplier-result" type="button" data-edit-supplier="${supplier.id}">
          <span class="finance-supplier-avatar">${financeIcon('user')}</span>
          <span class="finance-supplier-result__content">
            <strong>${escapeHtml(getSupplierName(supplier))}</strong>
            <span class="finance-supplier-result__meta">
              <span>${financeIcon('whatsapp')} WhatsApp: <b>${escapeHtml(getSupplierWhatsapp(supplier) || '-')}</b></span>
              <i></i>
              <span>${financeIcon('file')} CNPJ/CPF: <b>${escapeHtml(getSupplierDocument(supplier) || '-')}</b></span>
              <i></i>
              <span>${financeIcon('location')} Cidade: <b>${escapeHtml(getSupplierCity(supplier) || '-')}</b></span>
            </span>
          </span>
          <span class="finance-supplier-chevron">${financeIcon('chevron')}</span>
        </button>
      `).join('')}
    </div>
  ` : '<p class="table-empty">Nenhum fornecedor encontrado.</p>';
}

function exportSuppliers() {
  const fields = ['Nome', 'WhatsApp', 'CNPJ/CPF', 'E-mail', 'Cidade', 'Observações'];
  const quote = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
  const rows = financeState.suppliers.map((supplier) => [
    getSupplierName(supplier),
    getSupplierWhatsapp(supplier),
    getSupplierDocument(supplier),
    supplier.email,
    getSupplierCity(supplier),
    supplier.notes,
  ]);
  const csv = `\uFEFF${[fields, ...rows].map((row) => row.map(quote).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fornecedores-${todayKey()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  showFinanceToast('Lista de fornecedores exportada.');
}

async function submitSupplierEditor(container, event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = container.querySelector('[data-supplier-editor-message]');
  if (!financeState.suppliersAvailable) {
    message.textContent = 'Cadastro de fornecedores depende da proposta SQL ainda não aplicada.';
    return;
  }

  const payload = {
    name: nullableText(form.elements.name.value),
    document: nullableText(form.elements.document.value),
    whatsapp: nullableText(form.elements.whatsapp.value),
    email: nullableText(form.elements.email.value),
    city: nullableText(form.elements.city.value),
    notes: nullableText(form.elements.notes.value),
    updated_by: financeState.profile?.id || null,
  };

  if (!payload.name) {
    message.textContent = 'Informe o nome do fornecedor.';
    return;
  }

  message.textContent = 'Salvando fornecedor...';
  try {
    const request = financeState.editingSupplier
      ? supabase.from('suppliers').update(payload).eq('id', financeState.editingSupplier.id).select('*').single()
      : supabase.from('suppliers').insert({ ...payload, created_by: financeState.profile?.id || null }).select('*').single();

    const { data, error } = await request;
    if (error) throw error;

    financeState.suppliers = [data, ...financeState.suppliers.filter((supplier) => supplier.id !== data.id)]
      .sort((a, b) => getSupplierName(a).localeCompare(getSupplierName(b), 'pt-BR'));
    financeState.editingSupplier = null;
    resetSupplierEditor(container);
    renderSupplierManagerList(container);
    setSupplierManagerView(container, 'list');
    message.textContent = '';
    showFinanceToast('Fornecedor salvo com sucesso.');
  } catch (error) {
    console.error('Erro ao salvar fornecedor:', error);
    message.textContent = `Erro ao salvar fornecedor: ${error.message}`;
  }
}

function renderSummaryCards(container) {
  const target = container.querySelector('[data-finance-summary]');
  if (!target) return;

  const monthStart = monthStartKey();
  const activeRows = getRowsInSelectedPeriod().filter((row) => ['active', 'paid'].includes(row.status));
  const monthRows = financeState.filters.dateFrom
    ? activeRows
    : activeRows.filter((row) => String(row.date || '').slice(0, 10) >= monthStart);
  const totalIncome = sumRows(activeRows, (row) => row.type === 'income');
  const totalExpense = sumRows(activeRows, (row) => row.type === 'expense');
  const monthIncome = sumRows(monthRows, (row) => row.type === 'income');
  const monthExpenses = sumRows(monthRows, (row) => row.type === 'expense');
  const pendingExpenses = sumRows(financeState.rows, (row) => row.type === 'expense' && ['pending', 'overdue'].includes(row.status));

  const cards = [
    { label: 'Saldo disponível', value: totalIncome - totalExpense, icon: 'wallet', tone: 'gold', delta: '+8,4%', positive: true },
    { label: 'Receitas do mês', value: monthIncome, icon: 'trendUp', tone: 'green', delta: '+15,2%', positive: true },
    { label: 'Despesas do mês', value: monthExpenses, icon: 'trendDown', tone: 'red', delta: '+6,7%', positive: false },
    { label: 'Saldo projetado', value: monthIncome - monthExpenses - pendingExpenses, icon: 'target', tone: 'blue', delta: '+10,5%', positive: true },
  ];

  target.innerHTML = cards.map((card) => `
    <article class="finance-kpi-card finance-kpi-card--${card.tone}">
      <span class="finance-kpi-card__icon">${financeIcon(card.icon)}</span>
      <div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(currency(card.value))}</strong><small class="${card.positive ? 'is-positive' : 'is-negative'}">↑ ${card.delta} <em>vs. mês anterior</em></small></div>
    </article>
  `).join('');
  renderFinanceChart(container);
  renderFinanceAttention(container);
}

function renderFinanceChart(container) {
  const target = container.querySelector('[data-finance-chart]');
  if (!target) return;
  const monthMode = financeState.chartRange !== '30';
  const monthCount = Number(financeState.chartRange);
  const now = new Date();
  const periods = monthMode
    ? Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index), 1);
      return { key: dateKey(date).slice(0, 7), label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') };
    })
    : ['01–07', '08–14', '15–21', '22–28', '29–31'].map((label) => ({ label }));
  const labels = periods.map((period) => period.label);
  const buckets = labels.map(() => ({ income: 0, expense: 0 }));
  financeState.rows.filter((row) => ['active', 'paid'].includes(row.status)).forEach((row) => {
    const rowDate = parseLocalDate(row.date);
    const index = monthMode
      ? periods.findIndex((period) => period.key === String(row.date || '').slice(0, 7))
      : Math.min(4, Math.floor(((rowDate?.getDate() || 1) - 1) / 7));
    if (index < 0) return;
    buckets[index][row.type === 'income' ? 'income' : 'expense'] += row.amount;
  });
  const max = Math.max(1, ...buckets.flatMap((item) => [item.income, item.expense]));
  const step = labels.length > 1 ? 720 / (labels.length - 1) : 0;
  const xy = (value, index) => [70 + index * step, 230 - (value / max) * 170];
  const points = (type) => buckets.map((item, index) => xy(item[type], index).join(',')).join(' ');
  const dots = (type) => buckets.map((item, index) => { const [x, y] = xy(item[type], index); return `<circle cx="${x}" cy="${y}" r="5" class="${type}-dot"><title>${labels[index]}: ${currency(item[type])}</title></circle>`; }).join('');
  const incomeArea = buckets.length
    ? `70,230 ${buckets.map((item, index) => xy(item.income, index).join(',')).join(' ')} ${70 + (buckets.length - 1) * step},230`
    : '';
  target.innerHTML = `<div class="finance-panel__header"><div><h3>Fluxo de caixa</h3><div class="finance-chart-legend"><button class="is-income ${financeState.chartSeries.income ? 'is-active' : ''}" data-chart-series="income"><i></i>Receitas</button><button class="is-expense ${financeState.chartSeries.expense ? 'is-active' : ''}" data-chart-series="expense"><i></i>Despesas</button></div></div><div class="finance-chart-tabs"><button class="${financeState.chartRange === '30' ? 'is-active' : ''}" data-chart-range="30">30 dias</button><button class="${financeState.chartRange === '6' ? 'is-active' : ''}" data-chart-range="6">6 meses</button><button class="${financeState.chartRange === '12' ? 'is-active' : ''}" data-chart-range="12">12 meses</button></div></div><svg class="finance-line-chart" viewBox="0 0 840 270" role="img" aria-label="Fluxo de caixa">${[60,102,144,186,228].map((y) => `<line x1="55" y1="${y}" x2="805" y2="${y}" class="grid"/>`).join('')}${financeState.chartSeries.income ? `<polygon points="${incomeArea}" class="income-area"/><polyline points="${points('income')}" class="income"/>${dots('income')}` : ''}${financeState.chartSeries.expense ? `<polyline points="${points('expense')}" class="expense"/>${dots('expense')}` : ''}${labels.map((label, index) => `<text x="${70 + index * step}" y="258" text-anchor="middle">${label}</text>`).join('')}</svg>`;
}

function renderFinanceAttention(container) {
  const target = container.querySelector('[data-finance-attention]');
  if (!target) return;
  const overdue = financeState.rows.filter((row) => row.status === 'overdue');
  const pending = financeState.rows.filter((row) => row.status === 'pending');
  const monthIncome = sumRows(financeState.rows.filter((row) => String(row.date || '').slice(0, 7) === todayKey().slice(0, 7)), (row) => row.type === 'income' && ['active', 'paid'].includes(row.status));
  const goal = Number(financeState.monthlyGoal || 0);
  const percent = goal ? Math.min(100, monthIncome / goal * 100) : 0;
  target.innerHTML = `<div class="finance-panel__header"><h3>Precisa da sua atenção</h3></div><div class="finance-attention-list"><button class="is-overdue" data-finance-quick-filter="overdue"><span>${financeIcon('calendar')}</span><div><strong>${overdue.length} contas vencidas</strong><small>${currency(sumRows(overdue, () => true))}</small></div><b>›</b></button><button class="is-pending" data-finance-quick-filter="pending"><span>${financeIcon('file')}</span><div><strong>${pending.length} despesas pendentes</strong><small>${currency(sumRows(pending, () => true))}</small></div><b>›</b></button><button class="is-goal" data-finance-goal-link><span>${financeIcon('target')}</span><div><strong>Meta mensal em ${Math.round(percent)}%</strong><small>faltam ${currency(Math.max(0, goal - monthIncome))}</small></div><b>›</b></button></div><button class="finance-panel__footer-link" data-finance-show-all>Ver todas <span>›</span></button>`;
}

function renderFinanceGoal(container) {
  const target = container.querySelector('[data-finance-goal]');
  if (!target) return;

  const monthStart = monthStartKey();
  const activeRows = financeState.rows.filter((row) => ['active', 'paid'].includes(row.status));
  const monthIncome = sumRows(
    activeRows.filter((row) => String(row.date || '').slice(0, 10) >= monthStart),
    (row) => row.type === 'income',
  );
  const goal = Number(financeState.monthlyGoal || 0);
  const percent = goal > 0 ? Math.min(100, (monthIncome / goal) * 100) : 0;
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const limit = dateKey(nextWeek);
  const payables = financeState.rows.filter((row) => row.type === 'expense' && ['pending', 'overdue'].includes(row.status) && String(row.date || '').slice(0, 10) <= limit).slice(0, 3);
  const receivables = financeState.rows.filter((row) => row.type === 'income' && ['pending'].includes(row.status) && String(row.date || '').slice(0, 10) <= limit).slice(0, 3);

  target.innerHTML = `
    <article class="finance-panel finance-operation-card finance-operation-card--payable"><div class="finance-operation-card__title">${financeIcon('file')}<h3>Contas a pagar</h3><span>Próximos 7 dias — <b>${currency(sumRows(payables, () => true))}</b></span></div><div class="finance-operation-list">${payables.length ? payables.map((row) => `<div><span>${escapeHtml(row.description || '-')}</span><time>${formatDate(row.date).slice(0,5)}</time><strong class="is-expense">${currency(row.amount)}</strong></div>`).join('') : `<div class="finance-empty-state"><span>${financeIcon('file')}</span><strong>Nenhuma conta nos próximos 7 dias.</strong><small>Tudo em dia por aqui.</small></div>`}</div><button data-finance-quick-filter="pending">Ver todas <span>›</span></button></article>
    <article class="finance-panel finance-operation-card finance-operation-card--receivable"><div class="finance-operation-card__title">${financeIcon('calendar')}<h3>Recebimentos previstos</h3><span>Próximos 7 dias — <b>${currency(sumRows(receivables, () => true))}</b></span></div><div class="finance-operation-list">${receivables.length ? receivables.map((row) => `<div><span>${escapeHtml(row.description || '-')}</span><time>${formatDate(row.date).slice(0,5)}</time><strong class="is-income">${currency(row.amount)}</strong></div>`).join('') : `<div class="finance-empty-state"><span>${financeIcon('calendar')}</span><strong>Nenhum recebimento previsto.</strong><small>Novos recebimentos aparecerão aqui.</small></div>`}</div><button data-finance-quick-filter="pending">Ver todas <span>›</span></button></article>
    <article class="finance-panel finance-goal-card"><div class="finance-operation-card__title">${financeIcon('target')}<h3>Meta do mês</h3><span>${currency(monthIncome)} / ${currency(goal)}</span></div><div><strong>${Math.round(percent)}%</strong><div class="finance-goal-progress"><i style="width:${percent}%"></i></div><p>${currency(Math.max(0, goal - monthIncome))} para alcançar</p></div><a href="#/configuracoes">Ver detalhes</a></article>
  `;
}

function renderFinanceList(container) {
  const target = container.querySelector('[data-finance-list]');
  if (!target) return;

  const search = normalize(financeState.recentSearch);
  const filteredRows = getFilteredRows().filter((row) => !search || normalize(`${row.description} ${row.category} ${row.reference}`).includes(search));
  const rows = filteredRows.slice(0, financeState.recentLimit);
  if (!rows.length) {
    target.innerHTML = '<p class="table-empty">Nenhum lançamento encontrado.</p>';
    return;
  }

  target.innerHTML = `
    <div class="table-shell">
      <table class="data-table finance-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Pagamento</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${rows.map(renderFinanceRow).join('')}</tbody>
      </table>
    </div>
    ${filteredRows.length > rows.length ? `<button class="finance-load-more" type="button" data-finance-load-more>Carregar mais</button>` : ''}
  `;
}

function renderFinanceRow(row) {
  const valueClass = row.type === 'expense' ? 'finance-value--negative' : 'finance-value--positive';
  const canEdit = isAdmin(financeState.profile) && row.editable && row.status !== 'cancelled';
  const canPay = canEdit && ['pending', 'overdue'].includes(row.status);
  const canCancel = canEdit && Boolean(row.expense?.id);
  const statusClass = row.status === 'cancelled'
    ? 'status-badge--inactive'
    : ['pending', 'overdue'].includes(row.status)
      ? 'status-badge--warning'
      : 'status-badge--active';
  return `
    <tr>
      <td data-label="Data">${escapeHtml(formatDate(row.date))}</td>
      <td data-label="Descrição">${escapeHtml(row.description || '-')}</td>
      <td data-label="Categoria">${escapeHtml(row.category || '-')}</td>
      <td data-label="Pagamento">${escapeHtml(paymentLabels[row.paymentMethod] || row.paymentMethod || '-')}</td>
      <td data-label="Valor"><strong class="${valueClass}">${row.type === 'expense' ? '-' : '+'}${currency(row.amount)}</strong></td>
      <td data-label="Status"><span class="status-badge ${statusClass}">${escapeHtml(statusLabels[row.status] || row.status)}</span></td>
      <td data-label="Ações">
        <div class="finance-row-actions"><button type="button" aria-label="Ações" data-finance-row-menu="${row.id}">${financeIcon('more')}</button><div data-finance-row-menu-panel="${row.id}" hidden><button type="button" data-finance-view="${row.id}">Visualizar</button>${canEdit ? `<button type="button" data-edit-expense="${row.expense?.id || ''}">Editar</button>${canPay ? `<button type="button" data-pay-expense="${row.expense?.id || ''}">Dar baixa</button>` : ''}${canCancel ? `<button type="button" data-cancel-expense-row="${row.expense.id}">Cancelar</button>` : ''}` : ''}</div></div>
      </td>
    </tr>
  `;
}

function getExpenseStatus(expense) {
  if (expense?.deleted_at || expense?.status === 'cancelled') return 'cancelled';
  if (expense?.status === 'paid') return 'paid';
  if (expense?.status === 'pending') {
    return isPastDate(getExpenseDueDate(expense)) ? 'overdue' : 'pending';
  }
  if (!expense?.financial_entry_id) {
    return isPastDate(getExpenseDueDate(expense)) ? 'overdue' : 'pending';
  }
  const entry = financeState.entries.find((item) => item.id === expense.financial_entry_id);
  return entry?.status || 'active';
}

function openExpenseModal(container, expense = null) {
  if (!isAdmin(financeState.profile)) return;
  financeState.editingExpense = expense;
  financeState.showSupplierForm = false;
  financeState.supplierSearch = '';
  const modal = container.querySelector('[data-expense-modal]');
  const form = container.querySelector('[data-expense-form]');
  const title = container.querySelector('#expense-modal-title');
  const message = container.querySelector('[data-expense-message]');
  const cancelButton = container.querySelector('[data-cancel-expense]');
  const paidButton = container.querySelector('[data-open-pay-expense]');

  form.reset();
  message.textContent = '';
  title.textContent = expense ? 'Editar despesa' : 'Nova movimentação';
  form.elements.movement_type.value = 'expense';
  form.elements.movement_type.disabled = Boolean(expense);
  form.elements.expense_date.value = todayKey();
  form.elements.due_date.value = todayKey();
  form.elements.expense_status.value = 'pending';
  financeState.selectedSupplier = null;

  if (expense) {
    const parsedNotes = parseExpenseNotes(expense.notes);
    financeState.selectedSupplier = getExpenseSupplier(expense);
    form.elements.description.value = expense.description || '';
    form.elements.category.value = expense.category || '';
    form.elements.amount.value = Number(expense.amount || 0).toFixed(2);
    form.elements.payment_method.value = expense.payment_method || 'pix';
    form.elements.expense_date.value = expense.expense_date || todayKey();
    form.elements.due_date.value = getExpenseDueDate(expense) || todayKey();
    form.elements.expense_status.value = getExpenseStatus(expense) === 'cancelled' ? 'cancelled' : expense.financial_entry_id ? 'active' : 'pending';
    form.elements.notes.value = parsedNotes.observations;
  }

  const status = expense ? getExpenseStatus(expense) : null;
  cancelButton.hidden = !expense || status === 'cancelled';
  paidButton.hidden = !expense || !['pending', 'overdue'].includes(status);
  const notesCounter = container.querySelector('[data-finance-notes-count]');
  if (notesCounter) notesCounter.textContent = `${form.elements.notes.value.length}/300`;
  renderSupplierArea(container);
  updateMovementForm(container);
  modal.hidden = false;
}

function updateMovementForm(container) {
  const form = container.querySelector('[data-expense-form]');
  if (!form) return;
  const isIncome = form.elements.movement_type.value === 'income';
  const supplierField = container.querySelector('[data-expense-supplier-field]');
  const categoryLabel = container.querySelector('[data-finance-category-label]');
  const saveButton = container.querySelector('[data-save-movement]');
  if (supplierField) supplierField.hidden = isIncome;
  if (categoryLabel) categoryLabel.textContent = isIncome ? 'Categoria da receita' : 'Categoria da despesa';
  if (saveButton) saveButton.innerHTML = `${financeIcon('check')} ${isIncome ? 'Salvar receita' : 'Salvar despesa'}`;
  container.querySelectorAll('[data-movement-type-choice]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.movementTypeChoice === form.elements.movement_type.value);
  });
}

function closeExpenseModal(container) {
  container.querySelector('[data-expense-modal]').hidden = true;
  financeState.editingExpense = null;
  financeState.selectedSupplier = null;
  financeState.supplierSearch = '';
  financeState.showSupplierForm = false;
}

function getExpensePayload(form) {
  const notes = nullableText(form.elements.notes.value);
  const supplier = financeState.selectedSupplier;
  const parsed = financeState.editingExpense ? parseExpenseNotes(financeState.editingExpense.notes) : {};

  return {
    category: nullableText(form.elements.category.value),
    description: nullableText(form.elements.description.value),
    amount: parseNumber(form.elements.amount.value),
    payment_method: form.elements.payment_method.value || null,
    expense_date: form.elements.expense_date.value || todayKey(),
    supplier_id: supplier?.id || null,
    due_date: form.elements.due_date.value || todayKey(),
    notes: buildExpenseNotes({
      supplier: getSupplierName(supplier),
      supplierId: supplier?.id || null,
      supplierDocument: getSupplierDocument(supplier),
      supplierWhatsapp: getSupplierWhatsapp(supplier),
      dueDate: form.elements.due_date.value || todayKey(),
      paidAt: parsed.paidAt || '',
      paidPaymentMethod: parsed.paidPaymentMethod || '',
      paymentNotes: parsed.paymentNotes || '',
      observations: notes,
    }),
    supplier,
    updated_by: financeState.profile?.id || null,
  };
}

function getExpenseDbPayload(payload) {
  const { supplier, ...dbPayload } = payload;
  return dbPayload;
}

async function updateExpenseRecords(expense, payload) {
  const dbPayload = getExpenseDbPayload(payload);
  const financialEntry = expense.financial_entry_id
    ? financeState.entries.find((entry) => entry.id === expense.financial_entry_id)
    : null;

  if (financialEntry) {
    const { error: financialError } = await supabase
      .from('financial_entries')
      .update({
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        updated_by: financeState.profile?.id || null,
      })
      .eq('id', financialEntry.id);
    if (financialError) throw financialError;
  }

  const { error: expenseError } = await supabase
    .from('expenses')
    .update(dbPayload)
    .eq('id', expense.id);

  if (expenseError && financialEntry) {
    await supabase
      .from('financial_entries')
      .update({
        category: financialEntry.category,
        description: financialEntry.description,
        amount: financialEntry.amount,
        updated_by: financialEntry.updated_by || null,
      })
      .eq('id', financialEntry.id);
  }

  if (expenseError) throw expenseError;
}

async function payExpenseByRpc({ expenseId, paymentDate, paymentMethod, notes }) {
  const { error } = await supabase.rpc('pay_expense', {
    p_expense_id: expenseId,
    p_payment_date: paymentDate,
    p_payment_method: paymentMethod,
    p_notes: notes || null,
  });
  if (error) throw error;
}

async function cancelExpenseByRpc(expenseId, reason) {
  const { error } = await supabase.rpc('cancel_expense', {
    p_expense_id: expenseId,
    p_reason: reason,
  });
  if (error) throw error;
}

function selectSupplier(container, supplierId) {
  financeState.selectedSupplier = financeState.suppliers.find((supplier) => supplier.id === supplierId) || null;
  financeState.supplierSearch = '';
  financeState.showSupplierForm = false;
  renderSupplierArea(container);
}

function clearSupplier(container) {
  financeState.selectedSupplier = null;
  financeState.supplierSearch = '';
  renderSupplierArea(container);
}

async function saveInlineSupplier(container) {
  const form = container.querySelector('[data-expense-form]');
  const message = container.querySelector('[data-expense-message]');
  if (!financeState.suppliersAvailable) {
    message.textContent = 'Cadastro de fornecedores depende da proposta SQL ainda não aplicada.';
    return;
  }

  const name = nullableText(form.elements.new_supplier_name?.value);
  if (!name) {
    message.textContent = 'Informe o nome do fornecedor.';
    return;
  }

  message.textContent = 'Salvando fornecedor...';
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name,
        document: nullableText(form.elements.new_supplier_document?.value),
        whatsapp: nullableText(form.elements.new_supplier_whatsapp?.value),
        email: nullableText(form.elements.new_supplier_email?.value),
        city: nullableText(form.elements.new_supplier_city?.value),
        notes: nullableText(form.elements.new_supplier_notes?.value),
        created_by: financeState.profile?.id || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    financeState.suppliers = [data, ...financeState.suppliers.filter((supplier) => supplier.id !== data.id)];
    financeState.selectedSupplier = data;
    financeState.showSupplierForm = false;
    message.textContent = '';
    renderSupplierArea(container);
  } catch (error) {
    console.error('Erro ao salvar fornecedor:', error);
    message.textContent = `Erro ao salvar fornecedor: ${error.message}`;
  }
}

async function submitExpense(container, event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = container.querySelector('[data-expense-message]');
  if (!isAdmin(financeState.profile)) {
    message.textContent = 'Somente administradores podem editar despesas.';
    return;
  }
  const movementType = form.elements.movement_type.value;
  const wasEditing = Boolean(financeState.editingExpense);
  const payload = getExpensePayload(form);
  const desiredStatus = form.elements.expense_status.value;
  let cancellationReason = null;

  if ((movementType === 'expense' && !payload.supplier) || !payload.category || !payload.description || payload.amount <= 0) {
    message.textContent = 'Preencha descrição, categoria, valor e os campos obrigatórios.';
    return;
  }

  if (desiredStatus === 'cancelled') {
    cancellationReason = nullableText(window.prompt('Informe o motivo do cancelamento.'));
    if (!cancellationReason) {
      message.textContent = 'Informe o motivo do cancelamento.';
      return;
    }
  }

  message.textContent = 'Salvando despesa...';

  try {
    if (movementType === 'income' && !financeState.editingExpense) {
      const { error } = await supabase.from('financial_entries').insert({
        type: 'income',
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        status: desiredStatus === 'cancelled' ? 'cancelled' : 'active',
        created_by: financeState.profile?.id || null,
        updated_by: financeState.profile?.id || null,
      });
      if (error) throw error;
      closeExpenseModal(container);
      await loadFinanceData(container);
      showFinanceToast('Receita salva com sucesso.');
      return;
    }

    if (!financeState.editingExpense) {
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
          ...getExpenseDbPayload(payload),
          created_by: financeState.profile?.id || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (desiredStatus === 'active') {
        await payExpenseByRpc({
          expenseId: expense.id,
          paymentDate: todayKey(),
          paymentMethod: payload.payment_method,
          notes: 'Despesa cadastrada como paga.',
        });
      }

      if (desiredStatus === 'cancelled') {
        await cancelExpenseByRpc(expense.id, cancellationReason);
      }
    } else {
      const expense = financeState.editingExpense;
      const currentStatus = getExpenseStatus(expense);

      if (currentStatus === 'cancelled') {
        message.textContent = 'Despesa cancelada não pode ser editada.';
        return;
      }

      if (['active', 'paid'].includes(currentStatus) && desiredStatus === 'pending') {
        message.textContent = 'Despesa paga não pode voltar para pendente. Use cancelamento para preservar histórico.';
        return;
      }

      if (desiredStatus === 'cancelled') {
        await cancelExpenseByRpc(expense.id, cancellationReason);
      } else {
        await updateExpenseRecords(expense, payload);

        if (desiredStatus === 'active' && !['active', 'paid'].includes(currentStatus)) {
          await payExpenseByRpc({
            expenseId: expense.id,
            paymentDate: todayKey(),
            paymentMethod: payload.payment_method,
            notes: 'Despesa marcada como paga na edição.',
          });
        }
      }
    }

    closeExpenseModal(container);
    await loadFinanceData(container);
    showFinanceToast(wasEditing ? 'Despesa atualizada com sucesso.' : 'Despesa salva com sucesso.');
  } catch (error) {
    console.error('Erro ao salvar despesa:', error);
    message.textContent = `Erro ao salvar despesa: ${error.message}`;
  }
}

function openPayExpenseModal(container, expense) {
  if (!expense || !['pending', 'overdue'].includes(getExpenseStatus(expense))) return;
  financeState.payingExpense = expense;
  const modal = container.querySelector('[data-pay-expense-modal]');
  const form = container.querySelector('[data-pay-expense-form]');
  const message = container.querySelector('[data-pay-expense-message]');
  const summary = container.querySelector('[data-pay-expense-summary]');
  const supplier = getExpenseSupplier(expense);

  form.reset();
  form.elements.paid_at.value = todayKey();
  form.elements.paid_payment_method.value = expense.payment_method || 'pix';
  message.textContent = '';
  summary.innerHTML = `
    <article class="finance-pay-summary">
      <div><span>Fornecedor</span><strong>${escapeHtml(getSupplierName(supplier) || '-')}</strong></div>
      <div><span>Descrição</span><strong>${escapeHtml(expense.description || '-')}</strong></div>
      <div><span>Valor</span><strong>${escapeHtml(currency(expense.amount))}</strong></div>
      <div><span>Vencimento</span><strong>${escapeHtml(formatDate(getExpenseDueDate(expense)))}</strong></div>
    </article>
  `;
  modal.hidden = false;
}

function closePayExpenseModal(container) {
  container.querySelector('[data-pay-expense-modal]').hidden = true;
  financeState.payingExpense = null;
}

async function submitPayExpense(container, event) {
  event.preventDefault();
  const expense = financeState.payingExpense;
  const form = event.currentTarget;
  const message = container.querySelector('[data-pay-expense-message]');
  if (!expense) return;

  if (!form.elements.paid_at.value || !form.elements.paid_payment_method.value) {
    message.textContent = 'Informe data e forma de pagamento da baixa.';
    return;
  }

  message.textContent = 'Registrando baixa...';
  try {
    await payExpenseByRpc({
      expenseId: expense.id,
      paymentDate: form.elements.paid_at.value,
      paymentMethod: form.elements.paid_payment_method.value,
      notes: nullableText(form.elements.payment_notes.value),
    });
    closePayExpenseModal(container);
    closeExpenseModal(container);
    await loadFinanceData(container);
    showFinanceToast('Baixa registrada com sucesso.');
  } catch (error) {
    console.error('Erro ao dar baixa na despesa:', error);
    message.textContent = `Erro ao dar baixa: ${error.message}`;
  }
}

async function cancelExpense(container, expense = financeState.editingExpense) {
  const message = container.querySelector('[data-expense-message]');
  if (!expense) return;

  if (getExpenseStatus(expense) === 'cancelled') {
    if (message) message.textContent = 'Despesa cancelada não pode ser cancelada novamente.';
    return;
  }

  const reason = window.prompt('Informe o motivo do cancelamento.');
  if (!nullableText(reason)) {
    if (message) message.textContent = 'Informe o motivo do cancelamento.';
    return;
  }

  if (message) message.textContent = 'Cancelando despesa...';
  try {
    await cancelExpenseByRpc(expense.id, nullableText(reason));
    if (!container.querySelector('[data-expense-modal]')?.hidden) closeExpenseModal(container);
    await loadFinanceData(container);
    showFinanceToast('Movimentação cancelada com sucesso.');
  } catch (error) {
    console.error('Erro ao cancelar despesa:', error);
    if (message) message.textContent = `Erro ao cancelar despesa: ${error.message}`;
  }
}

function syncFilters(container) {
  const form = container.querySelector('[data-finance-filters]');
  financeState.filters.dateFrom = form.elements.date_from.value;
  financeState.filters.dateTo = form.elements.date_to.value;
  financeState.filters.type = form.elements.type.value;
  financeState.filters.status = form.elements.status.value;
  financeState.filters.paymentMethod = form.elements.payment_method.value;
  financeState.filters.origin = form.elements.origin.value;
  renderFinanceList(container);
}

function bindFinanceEvents(container) {
  const signal = financeState.abortController.signal;
  const filters = container.querySelector('[data-finance-filters]');

  bindPeriodSegmentedControl(container, { id: 'finance', value: 'month', onChange: (range) => {
    filters.elements.date_from.value = range.dateFrom;
    filters.elements.date_to.value = range.dateTo;
    syncFilters(container);
    renderSummaryCards(container);
    renderFinanceGoal(container);
  } });

  filters.addEventListener('input', () => syncFilters(container), { signal });
  filters.addEventListener('change', () => syncFilters(container), { signal });
  container.querySelector('[data-finance-search]')?.addEventListener('input', (event) => {
    financeState.recentSearch = event.target.value;
    financeState.recentLimit = 8;
    renderFinanceList(container);
  }, { signal });
  container.querySelector('[data-finance-filter-toggle]')?.addEventListener('click', () => {
    filters.hidden = !filters.hidden;
  }, { signal });
  const applyFinancePeriod = (value) => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = now;
    if (value === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (value === 'quarter') {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (value === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    }
    filters.elements.date_from.value = dateKey(start);
    filters.elements.date_to.value = dateKey(end);
    syncFilters(container);
    renderSummaryCards(container);
    renderFinanceGoal(container);
  };
  container.querySelector('[data-new-expense]')?.addEventListener('click', () => openExpenseModal(container), { signal });
  container.querySelector('[data-manage-suppliers]')?.addEventListener('click', () => openSupplierManager(container), { signal });
  container.querySelector('[data-expense-form]')?.addEventListener('submit', (event) => submitExpense(container, event), { signal });
  container.querySelector('[data-pay-expense-form]')?.addEventListener('submit', (event) => submitPayExpense(container, event), { signal });
  container.querySelector('[data-supplier-editor-form]')?.addEventListener('submit', (event) => submitSupplierEditor(container, event), { signal });

  container.querySelectorAll('[data-close-expense-modal]').forEach((button) => {
    button.addEventListener('click', () => closeExpenseModal(container), { signal });
  });
  container.querySelectorAll('[data-close-pay-expense]').forEach((button) => {
    button.addEventListener('click', () => closePayExpenseModal(container), { signal });
  });
  container.querySelectorAll('[data-close-supplier-manager]').forEach((button) => {
    button.addEventListener('click', () => closeSupplierManager(container), { signal });
  });

  container.addEventListener('input', (event) => {
    if (event.target.matches('[name="movement_type"]')) updateMovementForm(container);
    if (event.target.matches('[data-supplier-editor-form] input[name="name"]')) updateSupplierSaveState(container);
    if (event.target.matches('[data-expense-form] textarea[name="notes"]')) {
      const counter = container.querySelector('[data-finance-notes-count]');
      if (counter) counter.textContent = `${event.target.value.length}/300`;
    }
    if (event.target.matches('[data-expense-supplier-search]')) {
      const cursorStart = event.target.selectionStart;
      const cursorEnd = event.target.selectionEnd;
      financeState.supplierSearch = event.target.value;
      renderSupplierArea(container);
      const searchInput = container.querySelector('[data-expense-supplier-search]');
      searchInput?.focus();
      if (searchInput && cursorStart !== null && cursorEnd !== null) {
        searchInput.setSelectionRange(cursorStart, cursorEnd);
      }
      return;
    }

    if (event.target.matches('[data-supplier-manager-search]')) {
      renderSupplierManagerList(container);
    }
  }, { signal });

  container.addEventListener('click', (event) => {
    const movementTypeChoice = event.target.closest('[data-movement-type-choice]');
    if (movementTypeChoice) {
      const form = container.querySelector('[data-expense-form]');
      form.elements.movement_type.value = movementTypeChoice.dataset.movementTypeChoice;
      updateMovementForm(container);
      return;
    }
    const periodTrigger = event.target.closest('[data-finance-period-trigger]');
    const periodOption = event.target.closest('[data-finance-period]');
    if (periodTrigger) {
      const menu = container.querySelector('[data-finance-period-menu]');
      menu.hidden = !menu.hidden;
      periodTrigger.setAttribute('aria-expanded', String(!menu.hidden));
      return;
    }
    if (periodOption) {
      const menu = container.querySelector('[data-finance-period-menu]');
      const trigger = container.querySelector('[data-finance-period-trigger]');
      container.querySelector('[data-finance-period-label]').textContent = periodOption.textContent;
      container.querySelectorAll('[data-finance-period]').forEach((item) => item.classList.toggle('is-active', item === periodOption));
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      applyFinancePeriod(periodOption.dataset.financePeriod);
      return;
    }
    const periodMenu = container.querySelector('[data-finance-period-menu]');
    const periodMenuTrigger = container.querySelector('[data-finance-period-trigger]');
    if (periodMenu && !periodMenu.hidden) {
      periodMenu.hidden = true;
      periodMenuTrigger?.setAttribute('aria-expanded', 'false');
    }
    if (event.target.matches('[data-expense-modal]')) {
      closeExpenseModal(container);
      return;
    }
    if (event.target.matches('[data-pay-expense-modal]')) {
      closePayExpenseModal(container);
      return;
    }
    if (event.target.matches('[data-supplier-manager-modal]')) {
      closeSupplierManager(container);
      return;
    }
    const chartSeriesButton = event.target.closest('[data-chart-series]');
    const chartRangeButton = event.target.closest('[data-chart-range]');
    const quickFilterButton = event.target.closest('[data-finance-quick-filter]');
    const showAllButton = event.target.closest('[data-finance-show-all]');
    const loadMoreButton = event.target.closest('[data-finance-load-more]');
    const rowMenuButton = event.target.closest('[data-finance-row-menu]');
    const viewButton = event.target.closest('[data-finance-view]');
    const editButton = event.target.closest('[data-edit-expense]');
    const paidButton = event.target.closest('[data-open-pay-expense]');
    const payRowButton = event.target.closest('[data-pay-expense]');
    const cancelButton = event.target.closest('[data-cancel-expense]');
    const cancelRowButton = event.target.closest('[data-cancel-expense-row]');
    const selectSupplierButton = event.target.closest('[data-select-expense-supplier]');
    const clearSupplierButton = event.target.closest('[data-clear-expense-supplier]');
    const toggleSupplierFormButton = event.target.closest('[data-toggle-supplier-form]');
    const cancelSupplierFormButton = event.target.closest('[data-cancel-supplier-form]');
    const saveSupplierButton = event.target.closest('[data-save-supplier]');
    const editSupplierButton = event.target.closest('[data-edit-supplier]');
    const newSupplierEditorButton = event.target.closest('[data-new-supplier-editor]');
    const exportSuppliersButton = event.target.closest('[data-export-suppliers]');

    if (exportSuppliersButton) {
      exportSuppliers();
      return;
    }

    if (chartSeriesButton) {
      const series = chartSeriesButton.dataset.chartSeries;
      financeState.chartSeries[series] = !financeState.chartSeries[series];
      renderFinanceChart(container);
      return;
    }
    if (chartRangeButton) {
      financeState.chartRange = chartRangeButton.dataset.chartRange;
      renderFinanceChart(container);
      return;
    }
    if (quickFilterButton) {
      financeState.filters.status = quickFilterButton.dataset.financeQuickFilter;
      filters.elements.status.value = financeState.filters.status;
      filters.hidden = false;
      financeState.recentLimit = 8;
      renderFinanceList(container);
      container.querySelector('.finance-recent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (showAllButton) {
      financeState.recentLimit = Number.MAX_SAFE_INTEGER;
      renderFinanceList(container);
      container.querySelector('.finance-recent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (loadMoreButton) {
      financeState.recentLimit += 8;
      renderFinanceList(container);
      return;
    }
    if (rowMenuButton) {
      const panel = container.querySelector(`[data-finance-row-menu-panel="${rowMenuButton.dataset.financeRowMenu}"]`);
      container.querySelectorAll('[data-finance-row-menu-panel]').forEach((item) => { if (item !== panel) item.hidden = true; });
      if (panel) panel.hidden = !panel.hidden;
      return;
    }
    if (viewButton) {
      const row = financeState.rows.find((item) => String(item.id) === viewButton.dataset.financeView);
      if (row?.expense) openExpenseModal(container, row.expense);
      else if (row) showFinanceToast(`${row.description}: ${currency(row.amount)}`, 'info');
      return;
    }

    if (editButton) {
      const expense = financeState.expenses.find((item) => item.id === editButton.dataset.editExpense);
      if (expense) openExpenseModal(container, expense);
      return;
    }

    if (paidButton) {
      openPayExpenseModal(container, financeState.editingExpense);
      return;
    }

    if (payRowButton) {
      const expense = financeState.expenses.find((item) => item.id === payRowButton.dataset.payExpense);
      if (expense) openPayExpenseModal(container, expense);
      return;
    }

    if (cancelButton) {
      cancelExpense(container);
      return;
    }

    if (cancelRowButton) {
      const expense = financeState.expenses.find((item) => item.id === cancelRowButton.dataset.cancelExpenseRow);
      if (expense) cancelExpense(container, expense);
      return;
    }

    if (selectSupplierButton) {
      selectSupplier(container, selectSupplierButton.dataset.selectExpenseSupplier);
      return;
    }

    if (clearSupplierButton) {
      clearSupplier(container);
      return;
    }

    if (toggleSupplierFormButton) {
      financeState.showSupplierForm = true;
      renderSupplierArea(container);
      return;
    }

    if (cancelSupplierFormButton) {
      financeState.showSupplierForm = false;
      renderSupplierArea(container);
      return;
    }

    if (saveSupplierButton) {
      saveInlineSupplier(container);
      return;
    }

    if (editSupplierButton) {
      financeState.editingSupplier = financeState.suppliers.find((supplier) => supplier.id === editSupplierButton.dataset.editSupplier) || null;
      resetSupplierEditor(container);
      setSupplierManagerView(container, 'editor');
      return;
    }

    if (newSupplierEditorButton) {
      financeState.editingSupplier = null;
      resetSupplierEditor(container);
      setSupplierManagerView(container, 'editor');
      return;
    }

    if (event.target.closest('[data-back-supplier-list]')) {
      financeState.editingSupplier = null;
      resetSupplierEditor(container);
      renderSupplierManagerList(container);
      setSupplierManagerView(container, 'list');
    }
  }, { signal });
}

export function renderFinance(container, route, { profile }) {
  financeState.abortController?.abort();
  financeState.abortController = new AbortController();
  financeState.profile = profile;
  financeState.entries = [];
  financeState.expenses = [];
  financeState.suppliers = [];
  financeState.sales = [];
  financeState.orders = [];
  financeState.rows = [];
  financeState.editingExpense = null;
  financeState.selectedSupplier = null;
  financeState.supplierSearch = '';
  financeState.showSupplierForm = false;
  financeState.editingSupplier = null;
  financeState.payingExpense = null;
  financeState.supplierView = 'list';
  financeState.suppliersAvailable = true;
  financeState.monthlyGoal = 0;
  financeState.chartRange = '30';
  financeState.chartSeries = { income: true, expense: true };
  financeState.recentSearch = '';
  financeState.recentLimit = 8;
  financeState.filters = {
    dateFrom: '',
    dateTo: '',
    type: 'all',
    status: 'all',
    paymentMethod: 'all',
    origin: 'all',
  };

  if (!isAdmin(profile)) {
    window.location.hash = '#/dashboard';
    return;
  }

  renderFinanceLayout(container, route);
  bindFinanceEvents(container);
  loadFinanceData(container);
}
