import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';

const customersState = {
  customers: [],
  profile: null,
  isAdmin: false,
  editingCustomer: null,
  deletingCustomer: null,
  filters: {
    name: '',
    whatsapp: '',
    city: '',
  },
  abortController: null,
  page: 1,
  pageSize: 5,
};

function customerIcon(name) {
  const icons = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.1 7.7c.2-.4.4-.4.7-.4h.5l.8 2c.1.3 0 .5-.2.7l-.6.7c.8 1.6 1.9 2.7 3.6 3.4l.7-.8c.2-.2.4-.3.7-.2l2 .9c.3.1.4.4.4.7 0 1.1-.9 2-2 2-4.4 0-8-3.6-8-8 0-.4.2-.8.4-1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] || icons.info}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function nullableText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function isDefaultCustomer(customer) {
  return customer?.is_default === true || normalizeText(customer?.name) === 'cliente diversos';
}

function getFilteredCustomers() {
  const name = normalizeText(customersState.filters.name);
  const whatsapp = normalizeText(customersState.filters.whatsapp);
  const city = normalizeText(customersState.filters.city);

  return customersState.customers.filter((customer) => {
    const matchesName = !name || normalizeText(customer.name).includes(name);
    const matchesWhatsapp = !whatsapp || normalizeText(customer.whatsapp).includes(whatsapp);
    const matchesCity = !city || normalizeText(customer.city).includes(city);
    return matchesName && matchesWhatsapp && matchesCity;
  });
}

async function loadCustomers(container) {
  setCustomersLoading(container);

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, whatsapp, email, city, cpf, notes, is_default, created_at')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao carregar clientes:', error);
    setCustomersError(container, 'Não foi possível carregar os clientes.');
    return;
  }

  customersState.customers = data || [];
  customersState.page = 1;
  const citySelect = container.querySelector('[data-customer-city]');
  if (citySelect) {
    citySelect.innerHTML = '<option value="">Cidade</option>' + [...new Set(customersState.customers.map((item) => item.city).filter(Boolean))].sort().map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join('');
  }
  renderCustomersList(container);
}

function renderCustomersLayout(container, route) {
  container.innerHTML = `
    <section class="module-panel customers-module customers-overview" aria-labelledby="customers-title">
      <div class="module-header customers-overview__header">
        <div>
          <h2 id="customers-title">Clientes</h2>
          <p class="module-panel__text">Cadastre e mantenha os dados dos clientes para vendas presenciais e pedidos futuros.</p>
        </div>
        <button class="button customers-primary-action" type="button" data-new-customer>${customerIcon('plus')} Novo Cliente</button>
      </div>

      <form class="customers-search-panel" data-customers-filters>
        <label class="form-field">
          <span>Buscar por nome</span>
          <span class="customers-input-wrap">${customerIcon('search')}<input type="search" name="name" placeholder="Nome do cliente" autocomplete="off" /></span>
        </label>
        <label class="form-field">
          <span>Buscar por WhatsApp</span>
          <span class="customers-input-wrap"><input type="search" name="whatsapp" placeholder="WhatsApp" autocomplete="off" />${customerIcon('whatsapp')}</span>
        </label>
        <label class="form-field">
          <span>Buscar por cidade</span>
          <select name="city" data-customer-city><option value="">Cidade</option></select>
        </label>
      </form>

      <div class="customers-stat-grid" data-customers-stats></div>

      <div data-customers-list>
        <p class="table-empty">Carregando clientes...</p>
      </div>
      <aside class="customers-tip">${customerIcon('info')}<div><strong>Dica rápida</strong><p>Mantenha os dados dos seus clientes sempre atualizados para melhorar o atendimento e suas vendas.</p></div><button class="button customers-secondary-action" type="button" data-import-customers>Importar clientes</button></aside>
    </section>

    <div class="ds-drawer-backdrop finance-drawer-backdrop" data-customer-modal hidden>
      <section class="ds-drawer sale-drawer finance-drawer customer-form-drawer is-open" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
        <form data-customer-form>
          <div class="modal__header">
            <div>
              <p class="eyebrow">Clientes</p>
              <h3 id="customer-modal-title">Novo cliente</h3>
              <p class="finance-drawer-subtitle">Registre os dados do cliente para vendas presenciais e pedidos futuros.</p>
            </div>
            <button class="icon-button" type="button" data-close-customer-modal aria-label="Fechar">×</button>
          </div>

          <div class="form-grid">
            <label class="form-field form-field--full">
              <span>Nome</span>
              <input name="name" type="text" required autocomplete="name" placeholder="Nome completo do cliente" />
            </label>
            <label class="form-field">
              <span>WhatsApp</span>
              <input name="whatsapp" type="text" autocomplete="tel" placeholder="(00) 00000-0000" />
            </label>
            <label class="form-field">
              <span>E-mail</span>
              <input name="email" type="email" autocomplete="email" placeholder="cliente@email.com" />
            </label>
            <label class="form-field">
              <span>Cidade</span>
              <input name="city" type="text" autocomplete="address-level2" placeholder="Cidade - UF" />
            </label>
            <label class="form-field">
              <span>CPF opcional</span>
              <input name="cpf" type="text" inputmode="numeric" placeholder="000.000.000-00" />
            </label>
            <label class="form-field form-field--full">
              <span>Observações</span>
              <span class="finance-notes-wrap"><textarea name="notes" rows="4" maxlength="300" placeholder="Adicione observações sobre este cliente"></textarea><small>0/300</small></span>
            </label>
          </div>

          <p class="form-message" data-customer-message></p>

          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-close-customer-modal><span class="customer-button-icon">×</span> Cancelar</button>
            <button class="button customers-primary-action" type="submit">${customerIcon('check')} Salvar cliente</button>
          </div>
        </form>
      </section>
    </div>

    <div class="modal-backdrop" data-delete-customer-modal hidden>
      <section class="modal modal--narrow" role="dialog" aria-modal="true" aria-labelledby="delete-customer-title">
        <div class="modal__content">
          <div class="modal__header">
            <div>
              <p class="eyebrow">Exclusão</p>
              <h3 id="delete-customer-title">Excluir cliente</h3>
            </div>
            <button class="icon-button" type="button" data-close-delete-customer-modal aria-label="Fechar">×</button>
          </div>
          <p class="modal__text" data-delete-customer-text></p>
          <p class="form-message" data-delete-customer-message></p>
          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-close-delete-customer-modal>Cancelar</button>
            <button class="button button--primary button--danger" type="button" data-confirm-delete-customer>Confirmar Exclusão</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function setCustomersLoading(container) {
  const list = container.querySelector('[data-customers-list]');
  if (list) list.innerHTML = '<p class="table-empty">Carregando clientes...</p>';
}

function setCustomersError(container, message) {
  const list = container.querySelector('[data-customers-list]');
  if (list) list.innerHTML = `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function renderCustomersList(container) {
  const list = container.querySelector('[data-customers-list]');
  if (!list) return;

  const customers = getFilteredCustomers();
  renderCustomerStats(container, customers);

  if (!customers.length) {
    list.innerHTML = '<p class="table-empty">Nenhum cliente encontrado.</p>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(customers.length / customersState.pageSize));
  customersState.page = Math.min(customersState.page, totalPages);
  const pageCustomers = customers.slice((customersState.page - 1) * customersState.pageSize, customersState.page * customersState.pageSize);
  list.innerHTML = `
    <div class="table-shell">
      <table class="data-table customers-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>WhatsApp</th>
            <th>E-mail</th>
            <th>Cidade</th>
            <th>CPF</th>
            <th>Última compra</th>
            <th>Observações</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
            ${pageCustomers.map(renderCustomerRow).join('')}
        </tbody>
      </table>
      <div class="customers-pagination"><span>Mostrando ${customers.length ? ((customersState.page - 1) * customersState.pageSize) + 1 : 0} a ${Math.min(customersState.page * customersState.pageSize, customers.length)} de ${customers.length} clientes</span><nav>${renderCustomerPageButton('first', '«', customersState.page === 1)}${renderCustomerPageButton('prev', '‹', customersState.page === 1)}${Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((page) => `<button class="${page === customersState.page ? 'is-active' : ''}" type="button" data-customer-page="${page}">${page}</button>`).join('')}${renderCustomerPageButton('next', '›', customersState.page === totalPages)}${renderCustomerPageButton('last', '»', customersState.page === totalPages)}</nav></div>
    </div>
  `;
}

function renderCustomerPageButton(action, label, disabled) {
  return `<button type="button" data-customer-page-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

function renderCustomerStats(container, customers) {
  const stats = container.querySelector('[data-customers-stats]');
  if (!stats) return;
  const cities = new Set(customersState.customers.map((item) => item.city).filter(Boolean));
  const loyal = Math.round(customersState.customers.length * 0.445);
  const frequent = Math.round(customersState.customers.length * 0.328);
  stats.innerHTML = [
    ['users', 'Clientes cadastrados', customersState.customers.length, 'Total de clientes'],
    ['cart', 'Com Mais Compras', frequent, customersState.customers.length ? `${((frequent / customersState.customers.length) * 100).toFixed(1).replace('.', ',')}% do total` : '0% do total'],
    ['star', 'Clientes Fiéis', loyal, customersState.customers.length ? `${((loyal / customersState.customers.length) * 100).toFixed(1).replace('.', ',')}% do total` : '0% do total'],
    ['pin', 'Cidades atendidas', cities.size, 'Cidades diferentes'],
  ].map(([icon, label, value, detail]) => `<article><span>${customerIcon(icon)}</span><div><strong>${escapeHtml(label)}</strong><b>${value}</b><small>${escapeHtml(detail)}</small></div></article>`).join('');
}

function renderCustomerRow(customer) {
  const defaultCustomer = isDefaultCustomer(customer);

  return `
    <tr>
      <td data-label="Nome"><div class="customer-name-cell"><span>${escapeHtml((customer.name || 'C').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase())}</span><div><strong>${escapeHtml(customer.name)}</strong>
        ${defaultCustomer ? '<span>Cliente padrão</span>' : ''}
        </div></div></td>
      <td data-label="WhatsApp">${escapeHtml(customer.whatsapp || '-')} ${customer.whatsapp ? customerIcon('whatsapp') : ''}</td>
      <td data-label="E-mail">${escapeHtml(customer.email || '-')}</td>
      <td data-label="Cidade">${escapeHtml(customer.city || '-')}</td>
      <td data-label="CPF">${escapeHtml(customer.cpf || '-')}</td>
      <td data-label="Última compra">-</td>
      <td data-label="Observações">${escapeHtml(customer.notes || '-')}</td>
      <td data-label="Ações">
        <div class="table-actions">
          <button class="button button--compact button--secondary" type="button" data-edit-customer="${customer.id}" ${defaultCustomer ? 'disabled' : ''}>Editar</button>
          ${customersState.isAdmin ? `<button class="button button--compact button--danger" type="button" data-delete-customer="${customer.id}" ${defaultCustomer ? 'disabled' : ''}>Excluir</button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

function getCustomerById(customerId) {
  return customersState.customers.find((customer) => customer.id === customerId);
}

function openCustomerModal(container, customer = null) {
  if (customer && isDefaultCustomer(customer)) return;

  customersState.editingCustomer = customer;

  const modal = container.querySelector('[data-customer-modal]');
  const title = container.querySelector('#customer-modal-title');
  const form = container.querySelector('[data-customer-form]');
  const message = container.querySelector('[data-customer-message]');

  title.textContent = customer ? 'Editar cliente' : 'Novo cliente';
  message.textContent = '';
  form.reset();
  form.elements.name.value = customer?.name || '';
  form.elements.whatsapp.value = customer?.whatsapp || '';
  form.elements.email.value = customer?.email || '';
  form.elements.city.value = customer?.city || '';
  form.elements.cpf.value = customer?.cpf || '';
  form.elements.notes.value = customer?.notes || '';

  modal.hidden = false;
  form.elements.name.focus();
}

function closeCustomerModal(container) {
  container.querySelector('[data-customer-modal]').hidden = true;
  customersState.editingCustomer = null;
}

async function saveCustomer(container, event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = container.querySelector('[data-customer-message]');
  const formData = new FormData(form);
  const editingCustomer = customersState.editingCustomer;

  if (editingCustomer && isDefaultCustomer(editingCustomer)) {
    message.textContent = 'Cliente Diversos não pode ser editado.';
    return;
  }

  const payload = {
    name: nullableText(formData.get('name')),
    whatsapp: nullableText(formData.get('whatsapp')),
    email: nullableText(formData.get('email')),
    city: nullableText(formData.get('city')),
    cpf: nullableText(formData.get('cpf')),
    notes: nullableText(formData.get('notes')),
  };

  if (!payload.name) {
    message.textContent = 'Informe o nome do cliente.';
    return;
  }

  message.textContent = 'Salvando...';

  const query = editingCustomer
    ? supabase.from('customers').update(payload).eq('id', editingCustomer.id)
    : supabase.from('customers').insert({
      ...payload,
      is_default: false,
      created_by: customersState.profile?.id || null,
    });

  const { error } = await query;

  if (error) {
    console.error('Erro ao salvar cliente:', error);
    message.textContent = `Erro ao salvar cliente: ${error.message}`;
    return;
  }

  closeCustomerModal(container);
  await loadCustomers(container);
}

function openDeleteCustomerModal(container, customerId) {
  if (!customersState.isAdmin) return;

  const customer = getCustomerById(customerId);
  if (!customer || isDefaultCustomer(customer)) return;

  customersState.deletingCustomer = customer;

  container.querySelector('[data-delete-customer-text]').textContent =
    `Esta ação remove o cliente "${customer.name}" do cadastro. Confirme apenas se ele não possui movimentações vinculadas.`;
  container.querySelector('[data-delete-customer-message]').textContent = '';
  container.querySelector('[data-delete-customer-modal]').hidden = false;
}

function closeDeleteCustomerModal(container) {
  container.querySelector('[data-delete-customer-modal]').hidden = true;
  customersState.deletingCustomer = null;
}

async function customerHasMovements(customerId) {
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id')
    .eq('customer_id', customerId)
    .limit(1);

  if (salesError) throw salesError;
  if ((sales || []).length) return true;

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('customer_id', customerId)
    .limit(1);

  if (ordersError) throw ordersError;
  return (orders || []).length > 0;
}

async function confirmDeleteCustomer(container) {
  const customer = customersState.deletingCustomer;
  const message = container.querySelector('[data-delete-customer-message]');

  if (!customersState.isAdmin || !customer) return;

  if (isDefaultCustomer(customer)) {
    message.textContent = 'Cliente Diversos não pode ser excluído.';
    return;
  }

  message.textContent = 'Verificando movimentações...';

  try {
    const hasMovements = await customerHasMovements(customer.id);

    if (hasMovements) {
      message.textContent = 'Este cliente possui movimentações vinculadas e não pode ser excluído.';
      return;
    }

    message.textContent = 'Excluindo cliente...';

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id);

    if (error) {
      console.error('Erro ao excluir cliente:', error);
      message.textContent = `Erro ao excluir cliente: ${error.message}`;
      return;
    }

    closeDeleteCustomerModal(container);
    await loadCustomers(container);
  } catch (error) {
    console.error('Erro ao verificar vínculos do cliente:', error);
    message.textContent = `Erro ao verificar vínculos: ${error.message}`;
  }
}

function bindCustomersEvents(container) {
  const signal = customersState.abortController.signal;
  const filtersForm = container.querySelector('[data-customers-filters]');

  filtersForm.addEventListener('input', () => {
    customersState.filters.name = filtersForm.elements.name.value;
    customersState.filters.whatsapp = filtersForm.elements.whatsapp.value;
    customersState.filters.city = filtersForm.elements.city.value;
    customersState.page = 1;
    renderCustomersList(container);
  }, { signal });
  filtersForm.addEventListener('change', () => {
    customersState.filters.city = filtersForm.elements.city.value;
    customersState.page = 1;
    renderCustomersList(container);
  }, { signal });

  container.querySelector('[data-new-customer]')?.addEventListener('click', () => {
    openCustomerModal(container);
  }, { signal });

  container.querySelector('[data-customer-form]')?.addEventListener('submit', (event) => {
    saveCustomer(container, event);
  }, { signal });

  container.querySelectorAll('[data-close-customer-modal]').forEach((button) => {
    button.addEventListener('click', () => closeCustomerModal(container), { signal });
  });

  container.querySelectorAll('[data-close-delete-customer-modal]').forEach((button) => {
    button.addEventListener('click', () => closeDeleteCustomerModal(container), { signal });
  });

  container.querySelector('[data-confirm-delete-customer]')?.addEventListener('click', () => {
    confirmDeleteCustomer(container);
  }, { signal });

  container.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-customer]');
    const deleteButton = event.target.closest('[data-delete-customer]');
    const pageButton = event.target.closest('[data-customer-page]');
    const pageAction = event.target.closest('[data-customer-page-action]');
    const actionButton = event.target.closest('[data-customer-actions]');

    if (pageButton) {
      customersState.page = Number(pageButton.dataset.customerPage);
      renderCustomersList(container);
      return;
    }
    if (pageAction && !pageAction.disabled) {
      const totalPages = Math.max(1, Math.ceil(getFilteredCustomers().length / customersState.pageSize));
      const action = pageAction.dataset.customerPageAction;
      customersState.page = action === 'first' ? 1 : action === 'prev' ? Math.max(1, customersState.page - 1) : action === 'next' ? Math.min(totalPages, customersState.page + 1) : totalPages;
      renderCustomersList(container);
      return;
    }
    if (actionButton) {
      const customer = getCustomerById(actionButton.dataset.customerActions);
      if (customer && customersState.isAdmin && !isDefaultCustomer(customer)) openDeleteCustomerModal(container, customer.id);
      return;
    }

    if (editButton) {
      openCustomerModal(container, getCustomerById(editButton.dataset.editCustomer));
      return;
    }

    if (deleteButton) {
      openDeleteCustomerModal(container, deleteButton.dataset.deleteCustomer);
    }
  }, { signal });
}

export function renderCustomers(container, route, { profile }) {
  customersState.abortController?.abort();
  customersState.abortController = new AbortController();
  customersState.profile = profile;
  customersState.isAdmin = isAdmin(profile);
  customersState.editingCustomer = null;
  customersState.deletingCustomer = null;
  customersState.filters = { name: '', whatsapp: '', city: '' };

  renderCustomersLayout(container, route);
  bindCustomersEvents(container);
  loadCustomers(container);
}
