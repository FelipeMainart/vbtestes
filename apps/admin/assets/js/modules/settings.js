import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';
import { getBrandLogoSrc } from '../config/branding.js';

const companyAssetsBucket = 'company-assets';
const companyLogoPath = 'company/logo/logo';

const settingsState = {
  profile: null,
  settings: [],
  settingsByKey: new Map(),
  activeTab: 'company',
  stockKey: 'stock',
  ordersKey: 'orders',
  systemStats: null,
  abortController: null,
  view: 'hub',
  category: null,
  companySection: 'general',
  users: [],
  dirty: false,
  eventsBound: false,
};

const tabs = [
  { id: 'company', label: 'Loja' },
  { id: 'receipt', label: 'Impressão' },
  { id: 'finance', label: 'Financeiro' },
  { id: 'stock', label: 'Estoque' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'system', label: 'Sistema' },
];

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

function nullableText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function parseNumber(value) {
  const raw = String(value || '0').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function getLogoContentType(file) {
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (file?.type === 'image/png' || extension === 'png') return 'image/png';
  if (file?.type === 'image/jpeg' || extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (file?.type === 'image/svg+xml' || extension === 'svg') return 'image/svg+xml';
  if (file?.type === 'image/webp' || extension === 'webp') return 'image/webp';
  return null;
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

function getSetting(key, fallback = {}) {
  const row = settingsState.settingsByKey.get(key);
  if (!row) return fallback;
  return row.value ?? fallback;
}

function findSettingKey(candidates, fallback) {
  return candidates.find((key) => settingsState.settingsByKey.has(key)) || fallback;
}

function mergeSettingValue(key, patch) {
  const current = getSetting(key, {});
  if (Array.isArray(current) || Array.isArray(patch)) return patch;
  return { ...(current || {}), ...patch };
}

async function loadSettingsData() {
  const { data, error } = await supabase
    .from('settings')
    .select('id, key, value, updated_by, updated_at')
    .order('key', { ascending: true });

  if (error) throw error;

  settingsState.settings = data || [];
  settingsState.settingsByKey = new Map(settingsState.settings.map((item) => [item.key, item]));
  settingsState.stockKey = findSettingKey(['stock', 'inventory', 'estoque'], 'stock');
  settingsState.ordersKey = findSettingKey(['orders', 'order_settings', 'pedidos'], 'orders');
}

async function countTable(table) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) {
    console.warn(`Não foi possível contar ${table}:`, error.message);
    return 0;
  }
  return count || 0;
}

async function loadSystemStats() {
  if (settingsState.systemStats) return settingsState.systemStats;
  const [users, products, customers, sales, orders, expenses] = await Promise.all([
    countTable('profiles'),
    countTable('products'),
    countTable('customers'),
    countTable('sales'),
    countTable('orders'),
    countTable('expenses'),
  ]);
  const lastUpdated = settingsState.settings
    .map((item) => item.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  settingsState.systemStats = {
    users,
    products,
    customers,
    sales,
    orders,
    expenses,
    lastUpdated,
  };
  return settingsState.systemStats;
}

async function saveSetting(key, patch) {
  const value = mergeSettingValue(key, patch);
  const payload = {
    key,
    value,
    updated_by: settingsState.profile?.id || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('settings')
    .upsert(payload, { onConflict: 'key' })
    .select('id, key, value, updated_by, updated_at')
    .single();

  if (error) throw error;

  settingsState.settings = [
    data,
    ...settingsState.settings.filter((item) => item.key !== key),
  ].sort((a, b) => a.key.localeCompare(b.key));
  settingsState.settingsByKey.set(key, data);
  settingsState.systemStats = null;
  return data;
}

async function uploadCompanyLogo(file) {
  const contentType = getLogoContentType(file);
  if (!contentType) {
    throw new Error('Arquivo inválido. Use PNG, JPG, JPEG, SVG ou WEBP.');
  }

  const { error } = await supabase.storage
    .from(companyAssetsBucket)
    .upload(companyLogoPath, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Erro ao enviar logo para o bucket ${companyAssetsBucket}: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(companyAssetsBucket)
    .getPublicUrl(companyLogoPath);

  return `${data.publicUrl}?v=${Date.now()}`;
}

function renderTabs() {
  return `
    <div class="settings-tabs" role="tablist" aria-label="Configurações">
      ${tabs.map((tab) => `
        <button class="settings-tab ${settingsState.activeTab === tab.id ? 'is-active' : ''}" type="button" data-settings-tab="${tab.id}">
          ${escapeHtml(tab.label)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderCompanyTab() {
  const value = getSetting('company', {});
  return `
    <form class="settings-form" data-settings-form="company">
      <div class="form-grid">
        <label class="form-field"><span>Nome da loja</span><input name="name" value="${escapeHtml(value.name || '')}" /></label>
        <label class="form-field"><span>Razão social</span><input name="legal_name" value="${escapeHtml(value.legal_name || '')}" /></label>
        <label class="form-field"><span>Nome fantasia</span><input name="trade_name" value="${escapeHtml(value.trade_name || '')}" /></label>
        <label class="form-field"><span>CNPJ</span><input name="cnpj" value="${escapeHtml(value.cnpj || '')}" /></label>
        <label class="form-field"><span>Telefone</span><input name="phone" value="${escapeHtml(value.phone || '')}" /></label>
        <label class="form-field"><span>WhatsApp</span><input name="whatsapp" value="${escapeHtml(value.whatsapp || '')}" /></label>
        <label class="form-field"><span>Instagram</span><input name="instagram" value="${escapeHtml(value.instagram || '')}" /></label>
        <label class="form-field"><span>Email</span><input name="email" type="email" value="${escapeHtml(value.email || '')}" /></label>
        <label class="form-field form-field--full"><span>Endereço</span><input name="address" value="${escapeHtml(value.address || '')}" /></label>
        <label class="form-field"><span>Cidade</span><input name="city" value="${escapeHtml(value.city || '')}" /></label>
        <label class="form-field"><span>Estado</span><input name="state" value="${escapeHtml(value.state || '')}" maxlength="2" /></label>
        <label class="form-field"><span>CEP</span><input name="postal_code" value="${escapeHtml(value.postal_code || '')}" /></label>
        <label class="form-field"><span>Meta mensal de faturamento</span><input name="monthly_revenue_goal" value="${escapeHtml(value.monthly_revenue_goal || '')}" placeholder="50000" /></label>
      </div>
      <div class="settings-logo-control">
        <input name="current_logo_url" type="hidden" value="${escapeHtml(value.logo_url || '')}" data-current-logo-url />
        <input name="remove_logo" type="hidden" value="false" data-remove-logo />
        <div class="settings-logo-preview">
          ${value.logo_url ? `<img src="${escapeHtml(value.logo_url)}" alt="Logo da loja" data-logo-preview />` : '<span data-logo-preview>Sem logo configurada</span>'}
        </div>
        <div class="settings-logo-actions">
          <label class="button button--secondary" for="company-logo-file">Selecionar Arquivo</label>
          <input id="company-logo-file" name="logo_file" type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp" data-logo-file hidden />
          <button class="button button--secondary" type="button" data-remove-company-logo>Remover logo</button>
        </div>
        <p class="muted-text">A logo será salva em ${companyAssetsBucket}/${companyLogoPath}, substituindo o arquivo atual.</p>
      </div>
      <p class="form-message" data-settings-message></p>
      <button class="button button--primary" type="submit">Salvar Loja</button>
    </form>
  `;
}

function renderReceiptTab() {
  const value = getSetting('receipt', {});
  return `
    <form class="settings-form" data-settings-form="receipt">
      <div class="form-grid">
        <label class="form-field"><span>Nome exibido no recibo</span><input name="display_name" value="${escapeHtml(value.display_name || value.name || '')}" /></label>
        <label class="form-field"><span>Formato padrão</span><select name="default_format">
          <option value="a4" ${value.default_format === 'a4' ? 'selected' : ''}>A4</option>
          <option value="a4_quarter" ${['a4_quarter', 'a4_third'].includes(value.default_format) ? 'selected' : ''}>1/4 A4</option>
          <option value="thermal_80mm" ${value.default_format === 'thermal_80mm' ? 'selected' : ''}>Térmica 80mm</option>
        </select></label>
        <label class="form-field form-field--full"><span>Mensagem padrão</span><textarea name="default_message" rows="3">${escapeHtml(value.default_message || value.message || '')}</textarea></label>
        <label class="form-field form-field--full"><span>Mensagem de agradecimento</span><textarea name="thank_you_message" rows="3">${escapeHtml(value.thank_you_message || 'Obrigado pela preferência.')}</textarea></label>
        <label class="form-field form-field--full"><span>Mensagem complementar</span><textarea name="footer_message" rows="3">${escapeHtml(value.footer_message || 'Volte sempre.')}</textarea></label>
      </div>
      <p class="form-message" data-settings-message></p>
      <button class="button button--primary" type="submit">Salvar Impressão</button>
    </form>
  `;
}

function getExpenseCategories() {
  const value = getSetting('expense_categories', []);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.categories)) return value.categories;
  return [];
}

function renderFinanceTab() {
  const categories = getExpenseCategories();
  return `
    <form class="settings-form" data-settings-form="finance">
      <div class="settings-list-editor" data-categories-list>
        ${categories.map((category) => `
          <label class="form-field">
            <span>Categoria</span>
            <div class="settings-list-row">
              <input name="category" value="${escapeHtml(category)}" />
              <button class="button button--compact button--danger" type="button" data-remove-category>Excluir</button>
            </div>
          </label>
        `).join('')}
      </div>
      <button class="button button--secondary" type="button" data-add-category>Adicionar categoria</button>
      <p class="form-message" data-settings-message></p>
      <button class="button button--primary" type="submit">Salvar Financeiro</button>
    </form>
  `;
}

function renderStockTab() {
  const value = getSetting(settingsState.stockKey, {});
  return `
    <form class="settings-form" data-settings-form="stock">
      <div class="form-grid">
        <label class="form-field"><span>Estoque mínimo padrão</span><input name="default_minimum_stock" type="number" min="0" step="1" value="${escapeHtml(value.default_minimum_stock ?? 5)}" /></label>
        <label class="form-field"><span>Alerta de estoque</span><select name="stock_alert_enabled">
          <option value="true" ${value.stock_alert_enabled !== false ? 'selected' : ''}>Ativado</option>
          <option value="false" ${value.stock_alert_enabled === false ? 'selected' : ''}>Desativado</option>
        </select></label>
      </div>
      <p class="muted-text">Chave utilizada: ${escapeHtml(settingsState.stockKey)}</p>
      <p class="form-message" data-settings-message></p>
      <button class="button button--primary" type="submit">Salvar Estoque</button>
    </form>
  `;
}

function renderOrdersTab() {
  const value = getSetting(settingsState.ordersKey, {});
  return `
    <form class="settings-form" data-settings-form="orders">
      <div class="form-grid">
        <label class="form-field"><span>Dias para entregue virar finalizado</span><input name="auto_finalize_delivered_days" type="number" min="1" step="1" value="${escapeHtml(value.auto_finalize_delivered_days ?? 7)}" /></label>
        <label class="form-field"><span>Permitir edição após envio</span><select name="allow_edit_after_shipping">
          <option value="false" ${value.allow_edit_after_shipping !== true ? 'selected' : ''}>Não</option>
          <option value="true" ${value.allow_edit_after_shipping === true ? 'selected' : ''}>Sim</option>
        </select></label>
      </div>
      <p class="muted-text">Chave utilizada: ${escapeHtml(settingsState.ordersKey)}</p>
      <p class="form-message" data-settings-message></p>
      <button class="button button--primary" type="submit">Salvar Pedidos</button>
    </form>
  `;
}

function renderSystemTab() {
  const stats = settingsState.systemStats;
  const keys = settingsState.settings.map((item) => item.key);
  return `
    <div class="settings-system-grid">
      <article><span>Nome interno</span><strong>Veste Bem Admin</strong></article>
      <article><span>Versão atual</span><strong>1.0.0</strong></article>
      <article><span>Última atualização</span><strong>${escapeHtml(formatDateTime(stats?.lastUpdated))}</strong></article>
      <article><span>Usuários</span><strong>${escapeHtml(stats?.users ?? 0)}</strong></article>
      <article><span>Produtos</span><strong>${escapeHtml(stats?.products ?? 0)}</strong></article>
      <article><span>Clientes</span><strong>${escapeHtml(stats?.customers ?? 0)}</strong></article>
      <article><span>Vendas</span><strong>${escapeHtml(stats?.sales ?? 0)}</strong></article>
      <article><span>Pedidos</span><strong>${escapeHtml(stats?.orders ?? 0)}</strong></article>
      <article><span>Despesas</span><strong>${escapeHtml(stats?.expenses ?? 0)}</strong></article>
    </div>
    <article class="settings-known-keys">
      <span>Chaves encontradas</span>
      <strong>${keys.length ? escapeHtml(keys.join(', ')) : 'Nenhuma chave encontrada'}</strong>
    </article>
  `;
}

function renderActiveTab() {
  if (settingsState.activeTab === 'company') return renderCompanyTab();
  if (settingsState.activeTab === 'receipt') return renderReceiptTab();
  if (settingsState.activeTab === 'finance') return renderFinanceTab();
  if (settingsState.activeTab === 'stock') return renderStockTab();
  if (settingsState.activeTab === 'orders') return renderOrdersTab();
  return renderSystemTab();
}

async function renderSettingsContent(container) {
  if (settingsState.activeTab === 'system') {
    container.querySelector('[data-settings-content]').innerHTML = '<p class="table-empty">Carregando informações do sistema...</p>';
    await loadSystemStats();
  }
  container.querySelector('[data-settings-tabs]').innerHTML = renderTabs();
  container.querySelector('[data-settings-content]').innerHTML = renderActiveTab();
}

function getFormMessage(form) {
  return form.querySelector('[data-settings-message]');
}

async function submitSettingsForm(container, form) {
  const type = form.dataset.settingsForm;
  const formData = new FormData(form);
  const message = getFormMessage(form);
  message.textContent = 'Salvando...';

  try {
    if (type === 'company') {
      const email = nullableText(formData.get('email'));
      const cnpj = String(formData.get('cnpj') || '').replace(/\D/g, '');
      const postalCode = String(formData.get('postal_code') || '').replace(/\D/g, '');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
      if (cnpj && cnpj.length !== 14) throw new Error('CNPJ deve conter 14 dígitos.');
      if (postalCode && postalCode.length !== 8) throw new Error('CEP deve conter 8 dígitos.');
      const logoFile = formData.get('logo_file');
      const shouldRemoveLogo = formData.get('remove_logo') === 'true';
      let logoUrl = nullableText(formData.get('current_logo_url'));

      if (!shouldRemoveLogo && logoFile?.name) {
        message.textContent = 'Enviando logo...';
        logoUrl = await uploadCompanyLogo(logoFile);
      }

      const companyPayload = {
        ...getSetting('company', {}),
        name: nullableText(formData.get('name')),
        legal_name: nullableText(formData.get('legal_name')),
        trade_name: nullableText(formData.get('trade_name')),
        cnpj: nullableText(formData.get('cnpj')),
        phone: nullableText(formData.get('phone')),
        whatsapp: nullableText(formData.get('whatsapp')),
        instagram: nullableText(formData.get('instagram')),
        email: nullableText(formData.get('email')),
        address: nullableText(formData.get('address')),
        city: nullableText(formData.get('city')),
        state: nullableText(formData.get('state')),
        postal_code: nullableText(formData.get('postal_code')),
        logo_url: shouldRemoveLogo ? null : logoUrl,
        monthly_revenue_goal: parseNumber(formData.get('monthly_revenue_goal')),
      };
      ['state_registration', 'municipal_registration', 'segment', 'tax_regime', 'street', 'number', 'complement', 'neighborhood', 'country', 'reference', 'business_hours', 'fiscal_notes', 'receipt_message', 'institutional_notes', 'responsible_name', 'website'].forEach((key) => {
        if (formData.has(key)) companyPayload[key] = nullableText(formData.get(key));
      });
      const existingCompany = getSetting('company', {});
      ['name', 'legal_name', 'trade_name', 'cnpj', 'phone', 'whatsapp', 'instagram', 'email', 'address', 'city', 'state', 'postal_code', 'monthly_revenue_goal'].forEach((key) => {
        if (!formData.has(key)) companyPayload[key] = existingCompany[key] ?? null;
      });
      const savedCompany = await saveSetting('company', companyPayload);
      window.dispatchEvent(new CustomEvent('company-settings-updated', { detail: savedCompany.value || companyPayload }));
    }

    if (type === 'receipt') {
      await saveSetting('receipt', {
        display_name: nullableText(formData.get('display_name')),
        default_message: nullableText(formData.get('default_message')),
        thank_you_message: nullableText(formData.get('thank_you_message')),
        footer_message: nullableText(formData.get('footer_message')),
        default_format: formData.get('default_format') || 'thermal_80mm',
        printer_name: nullableText(formData.get('printer_name')),
        paper_width: formData.get('paper_width') || '72',
        preview_before_print: formData.get('preview_before_print') === 'on',
        system_print_dialog: formData.get('system_print_dialog') === 'on',
        cut_margin: formData.get('cut_margin') === 'on',
      });
    }

    if (type === 'branding') {
      const logoFile = formData.get('logo_file');
      let logoUrl = getSetting('company', {}).logo_url || null;
      if (logoFile?.name) logoUrl = await uploadCompanyLogo(logoFile);
      const companyPayload = await saveSetting('company', { logo_url: logoUrl });
      await saveSetting('branding', {
        primary_color: formData.get('primary_color') || '#0f2748',
        secondary_color: formData.get('secondary_color') || '#c88a31',
        accent_color: formData.get('accent_color') || '#fbf3e6',
        success_color: formData.get('success_color') || '#16a34a',
      });
      window.dispatchEvent(new CustomEvent('company-settings-updated', { detail: companyPayload.value || {} }));
    }

    if (type === 'operation') {
      const reservationHours = Math.max(1, Math.round(parseNumber(formData.get('stock_reservation_hours')) || 24));
      const finalizeDays = Math.max(1, Math.round(parseNumber(formData.get('auto_finalize_days')) || 7));
      await saveSetting('operation', {
        default_customer: nullableText(formData.get('default_customer')) || 'Diversos',
        stock_reservation_hours: reservationHours,
        auto_finalize_days: finalizeDays,
        sale_edit_hours: Math.max(1, Math.round(parseNumber(formData.get('sale_edit_hours')) || 24)),
        prevent_negative_stock: formData.get('prevent_negative_stock') === 'on',
        require_customer: formData.get('require_customer') === 'on',
        require_cancel_note: formData.get('require_cancel_note') === 'on',
      });
    }

    if (type === 'finance') {
      const categories = [...new Set(formData.getAll('category').map(nullableText).filter(Boolean))];
      await saveSetting('expense_categories', categories);
    }

    if (type === 'stock') {
      await saveSetting(settingsState.stockKey, {
        default_minimum_stock: Math.max(0, Math.round(parseNumber(formData.get('default_minimum_stock')))),
        stock_alert_enabled: formData.get('stock_alert_enabled') === 'true',
      });
    }

    if (type === 'orders') {
      await saveSetting(settingsState.ordersKey, {
        auto_finalize_delivered_days: Math.max(1, Math.round(parseNumber(formData.get('auto_finalize_delivered_days')) || 7)),
        allow_edit_after_shipping: formData.get('allow_edit_after_shipping') === 'true',
      });
    }

    message.textContent = 'Configuração salva.';
    settingsState.dirty = false;
    window.vbAdminToast?.('Alterações salvas com sucesso.');
    if (settingsState.view === 'detail') await renderSettingsV2(container);
    else await renderSettingsContent(container);
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    message.textContent = `Erro ao salvar: ${error.message}`;
  }
}

function addCategory(container) {
  const list = container.querySelector('[data-categories-list]');
  if (!list) return;
  list.insertAdjacentHTML('beforeend', `
    <label class="form-field">
      <span>Categoria</span>
      <div class="settings-list-row">
        <input name="category" value="" />
        <button class="button button--compact button--danger" type="button" data-remove-category>Excluir</button>
      </div>
    </label>
  `);
  list.querySelector('label:last-child input')?.focus();
}

function updateLogoPreview(container, value) {
  const preview = container.querySelector('[data-logo-preview]');
  if (!preview) return;
  const url = nullableText(value);
  if (!url) {
    preview.outerHTML = '<span data-logo-preview>Sem logo configurada</span>';
    return;
  }
  preview.outerHTML = `<img src="${escapeHtml(url)}" alt="Logo da loja" data-logo-preview />`;
}

function previewLogoFile(container, file) {
  if (!file) return;
  const message = container.querySelector('[data-settings-message]');

  if (!getLogoContentType(file)) {
    if (message) message.textContent = 'Arquivo inválido. Use PNG, JPG, JPEG, SVG ou WEBP.';
    return;
  }

  const url = URL.createObjectURL(file);
  updateLogoPreview(container, url);
  const removeInput = container.querySelector('[data-remove-logo]');
  if (removeInput) removeInput.value = 'false';
  if (message) message.textContent = `Preview carregado. Ao salvar, o upload substituirá ${companyAssetsBucket}/${companyLogoPath}.`;
}

function removeCompanyLogo(container) {
  const removeInput = container.querySelector('[data-remove-logo]');
  const currentInput = container.querySelector('[data-current-logo-url]');
  const fileInput = container.querySelector('[data-logo-file]');
  if (removeInput) removeInput.value = 'true';
  if (currentInput) currentInput.value = '';
  if (fileInput) fileInput.value = '';
  updateLogoPreview(container, '');
}

function bindSettingsEvents(container) {
  const signal = settingsState.abortController.signal;

  container.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('[data-settings-tab]');
    const addButton = event.target.closest('[data-add-category]');
    const removeButton = event.target.closest('[data-remove-category]');

    if (tabButton) {
      settingsState.activeTab = tabButton.dataset.settingsTab;
      await renderSettingsContent(container);
      return;
    }

    if (addButton) {
      addCategory(container);
      return;
    }

    if (removeButton) {
      removeButton.closest('.form-field')?.remove();
    }
  }, { signal });

  container.addEventListener('change', (event) => {
    if (event.target.matches('[data-logo-file]')) {
      previewLogoFile(container, event.target.files?.[0]);
    }
  }, { signal });

  container.addEventListener('click', (event) => {
    const removeLogoButton = event.target.closest('[data-remove-company-logo]');
    if (removeLogoButton) removeCompanyLogo(container);
  }, { signal });

  container.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-settings-form]');
    if (!form) return;
    event.preventDefault();
    await submitSettingsForm(container, form);
  }, { signal });
}

function renderShell(container, route) {
  container.innerHTML = `
    <section class="module-panel settings-module" aria-labelledby="settings-title">
      <div class="module-header">
        <div>
          <p class="eyebrow">${escapeHtml(route.label)}</p>
          <h2 id="settings-title">Configurações</h2>
          <p class="module-panel__text">Preferências administrativas salvas em settings para uso futuro por dashboard, recibos, relatórios, impressões e integrações.</p>
        </div>
      </div>
      <div data-settings-tabs>${renderTabs()}</div>
      <div class="settings-content" data-settings-content>
        <p class="table-empty">Carregando configurações...</p>
      </div>
    </section>
  `;
}

const settingsCategories = [
  ['company', 'Empresa', 'Dados cadastrais, endereço, contatos e informações fiscais.', 'building', '12 campos configurados'],
  ['users', 'Usuários', 'Gerencie usuários, perfis e permissões de acesso.', 'users', 'Usuários cadastrados'],
  ['branding', 'Marca', 'Logotipos, cores e identidade visual do sistema.', 'palette', '3 logos configuradas'],
  ['printing', 'Impressão', 'Impressoras, formato térmico e preferências de recibo.', 'printer', 'Não configurado'],
  ['integrations', 'Integrações', 'Conecte o sistema com ferramentas e plataformas externas.', 'plug', '6 integrações disponíveis'],
  ['notifications', 'Notificações', 'Canais e eventos de comunicação da operação.', 'bell', 'Não configurado'],
  ['security', 'Segurança', 'Sessões, senha, autenticação e regras de acesso.', 'shield', 'Em breve'],
  ['operation', 'Operação', 'Regras de negócio, padrões e comportamentos do sistema.', 'settings', 'Regras configuradas'],
  ['system', 'Sistema', 'Informações do sistema, ambiente e manutenção.', 'database', 'Versão 1.0.0'],
];

function settingsIcon(name) {
  const icons = {
    building: '<path d="M4 21h16M6 21V5l6-3 6 3v16M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><path d="M12 22a10 10 0 1 1 10-10c0 1.5-1.2 2.5-2.7 2.5h-2.1c-1.2 0-2 .9-2 2 0 1.2.8 2 2 2H18c-1.7 2.2-3.8 3.5-6 3.5Z"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2M7 8h10v4a5 5 0 0 1-10 0Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.8v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H5.5v-2.8h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.8v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.6 1Z"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>', save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', upload: '<path d="M12 16V3M7 8l5-5 5 5M5 21h14"/>' };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] || icons.settings}</svg>`;
}

function renderSettingsHub(stats) {
  const userCount = stats?.users || 0;
  return `<section class="module-panel settings-v2" aria-labelledby="settings-title"><header class="settings-v2__header"><div><h2 id="settings-title">Configurações</h2><p>Gerencie as preferências e informações do sistema.</p></div><button class="settings-v2__system-button" type="button" data-settings-category="system">${settingsIcon('database')} Informações do sistema</button></header><div class="settings-v2__grid">${settingsCategories.map(([id, title, description, icon, summary]) => `<button type="button" class="settings-v2-card settings-v2-card--${id}" data-settings-category="${id}"><span class="settings-v2-icon">${settingsIcon(icon)}</span><span class="settings-v2-card__content"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small><em>${id === 'users' ? `${userCount} usuários cadastrados` : escapeHtml(summary)}</em></span><i>${settingsIcon('arrow')}</i></button>`).join('')}</div></section>`;
}

function renderCompanyV2() {
  const value = getSetting('company', {});
  const sections = [['general', 'Dados gerais'], ['address', 'Endereço'], ['contacts', 'Contatos'], ['fiscal', 'Informações fiscais'], ['additional', 'Informações adicionais']];
  const fields = {
    general: [['name', 'Nome da empresa'], ['trade_name', 'Nome fantasia'], ['legal_name', 'Razão social'], ['cnpj', 'CNPJ'], ['state_registration', 'Inscrição estadual'], ['municipal_registration', 'Inscrição municipal'], ['segment', 'Segmento'], ['tax_regime', 'Regime tributário']],
    address: [['postal_code', 'CEP'], ['street', 'Rua'], ['number', 'Número'], ['complement', 'Complemento'], ['neighborhood', 'Bairro'], ['city', 'Cidade'], ['state', 'Estado'], ['country', 'País'], ['reference', 'Referência']],
    contacts: [['whatsapp', 'WhatsApp principal'], ['phone', 'Telefone alternativo'], ['email', 'E-mail'], ['instagram', 'Instagram'], ['website', 'Site'], ['business_hours', 'Horário de atendimento']],
    fiscal: [['tax_regime', 'Regime tributário'], ['state_registration', 'Inscrição estadual'], ['municipal_registration', 'Inscrição municipal'], ['fiscal_notes', 'Observações fiscais']],
    additional: [['receipt_message', 'Mensagem padrão de recibo'], ['institutional_notes', 'Observações institucionais'], ['responsible_name', 'Nome do responsável']],
  };
  const currentFields = fields[settingsState.companySection] || fields.general;
  return `<form id="settings-company-form" class="settings-v2-form" data-settings-form="company"><input type="hidden" name="current_logo_url" value="${escapeHtml(value.logo_url || '')}" /><input type="hidden" name="remove_logo" value="false" />${currentFields.map(([name, label]) => `<label class="form-field"><span>${escapeHtml(label)}</span>${name.includes('notes') || name.includes('message') ? `<textarea name="${name}" rows="3">${escapeHtml(value[name] || '')}</textarea>` : `<input name="${name}" value="${escapeHtml(value[name] || '')}" ${name === 'email' ? 'type="email"' : ''} />`}</label>`).join('')}<p class="form-message" data-settings-message></p></form>`;
}

function renderBrandingV2() {
  const company = getSetting('company', {});
  const logos = [['Logo clara', getBrandLogoSrc('dark')], ['Logo escura', getBrandLogoSrc('light')], ['Ícone', getBrandLogoSrc('icon')]];
  return `<form id="settings-branding-form" class="settings-v2-form" data-settings-form="branding"><section class="settings-v2-block"><h3>Logotipos</h3><p>Use os arquivos oficiais de marca em todos os canais do sistema.</p><div class="settings-v2-logo-grid">${logos.map(([label, src], index) => `<article><span>${escapeHtml(label)}</span><img src="${escapeHtml(index === 0 && company.logo_url ? company.logo_url : src)}" alt="${escapeHtml(label)}" /><label class="settings-v2-file-button">${settingsIcon('upload')} Trocar logo<input type="file" name="${index === 0 ? 'logo_file' : 'logo_placeholder'}" accept="image/png,image/jpeg,image/svg+xml,image/webp" ${index ? 'disabled' : ''} /></label></article>`).join('')}</div></section><section class="settings-v2-block"><h3>Cores do sistema</h3><div class="settings-v2-swatches"><label>Primária<input type="color" name="primary_color" value="#0f2748" /></label><label>Secundária<input type="color" name="secondary_color" value="#c88a31" /></label><label>Destaque<input type="color" name="accent_color" value="#fbf3e6" /></label><label>Sucesso<input type="color" name="success_color" value="#16a34a" /></label></div></section><p class="form-message" data-settings-message></p></form>`;
}

function renderUsersV2() {
  return `<section class="settings-v2-users"><div class="settings-v2-inline-tools"><label><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar usuário" data-settings-user-search /></label><select data-settings-user-role><option value="">Todos os perfis</option><option value="admin">Administrador</option><option value="seller">Vendedor</option></select><button class="button button--primary" type="button" data-settings-new-user>+ Novo usuário</button></div><div class="table-shell"><table class="data-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>${settingsState.users.length ? settingsState.users.map((user) => `<tr><td><span class="settings-v2-user-avatar">${escapeHtml(String(user.username || user.name || user.email || 'U').slice(0, 2).toUpperCase())}</span><strong>${escapeHtml(user.username || user.name || user.email || '-')}</strong><small>${escapeHtml(user.username ? user.name || user.email || '' : user.email || '')}</small></td><td>${user.role === 'admin' ? 'Administrador' : 'Vendedor'}</td><td><span class="status-badge ${user.active === false ? 'status-badge--pending' : 'status-badge--active'}">${user.active === false ? 'Inativo' : 'Ativo'}</span></td><td>${user.last_login_at ? escapeHtml(formatDateTime(user.last_login_at)) : '-'}</td><td><button class="button button--compact button--secondary" type="button" data-settings-user-edit="${escapeHtml(user.id)}">Editar</button></td></tr>`).join('') : '<tr><td colspan="5" class="table-empty">Nenhum usuário encontrado.</td></tr>'}</tbody></table></div></section>`;
}

function renderPrintingV2() {
  const value = getSetting('receipt', {});
  const paperWidth = String(value.paper_width || '72');
  return `<form id="settings-printing-form" class="settings-v2-form settings-v2-printing" data-settings-form="receipt"><section class="settings-v2-block"><h3>Impressora padrão</h3><div class="form-grid"><label class="form-field"><span>Nome da impressora</span><input name="printer_name" value="${escapeHtml(value.printer_name || 'ELGIN i9 USB')}" /></label><label class="form-field"><span>Largura útil</span><select name="paper_width"><option value="72" ${paperWidth === '72' ? 'selected' : ''}>72 mm útil</option><option value="58" ${paperWidth === '58' ? 'selected' : ''}>58 mm</option><option value="80" ${paperWidth === '80' ? 'selected' : ''}>80 mm físico</option><option value="auto" ${paperWidth === 'auto' ? 'selected' : ''}>Automático</option></select></label></div><p class="muted-text">A escolha real da impressora é feita no diálogo do navegador ou do sistema operacional.</p></section><section class="settings-v2-block"><h3>Opções de impressão</h3><label class="settings-v2-toggle"><input type="checkbox" name="preview_before_print" ${value.preview_before_print !== false ? 'checked' : ''} /> Exibir visualização antes de imprimir</label><label class="settings-v2-toggle"><input type="checkbox" name="system_print_dialog" ${value.system_print_dialog !== false ? 'checked' : ''} /> Abrir diálogo de impressão do sistema</label><label class="settings-v2-toggle"><input type="checkbox" name="cut_margin" ${value.cut_margin !== false ? 'checked' : ''} /> Aplicar margem técnica de corte</label></section><section class="settings-v2-block"><h3>Formato padrão do recibo</h3><label class="settings-v2-radio"><input type="radio" name="default_format" value="thermal_80mm" checked /> Recibo térmico</label><p class="form-message" data-settings-message></p></section></form>`;
}

function renderPlaceholderSettings(category) {
  const content = {
    integrations: ['Integrações', 'WhatsApp, Melhor Envio, Gateway Pix, Mercado Livre, Shopee e TikTok Shop'],
    notifications: ['Notificações', 'Canais e eventos de comunicação da operação'],
    security: ['Segurança', 'Senha, sessões e autenticação da conta'],
    operation: ['Operação', 'Padrões e regras operacionais do sistema'],
    system: ['Sistema', 'Informações técnicas e manutenção segura'],
  }[category] || ['Configurações', 'Preferências do sistema'];
  if (category === 'operation') return `<form id="settings-operation-form" class="settings-v2-form" data-settings-form="operation"><section class="settings-v2-block"><h3>Padrões</h3><div class="form-grid"><label class="form-field"><span>Cliente padrão</span><input name="default_customer" value="Diversos" /></label><label class="form-field"><span>Prazo da reserva de estoque</span><input name="stock_reservation_hours" type="number" min="1" value="24" /></label><label class="form-field"><span>Finalizar pedido após entrega</span><input name="auto_finalize_days" type="number" min="1" value="7" /></label><label class="form-field"><span>Prazo para edição de venda</span><input name="sale_edit_hours" type="number" min="1" value="24" /></label></div></section><section class="settings-v2-block"><h3>Regras</h3><label class="settings-v2-toggle"><input type="checkbox" name="prevent_negative_stock" checked /> Impedir estoque negativo</label><label class="settings-v2-toggle"><input type="checkbox" name="require_customer" /> Exigir cliente na venda</label><label class="settings-v2-toggle"><input type="checkbox" name="require_cancel_note" checked /> Exigir observação em cancelamento</label></section><p class="form-message" data-settings-message></p></form>`;
  if (category === 'system') return `<section class="settings-v2-system"><div class="settings-v2-system__grid"><article><span>Nome do sistema</span><strong>Veste Bem Admin</strong></article><article><span>Versão</span><strong>1.0.0</strong></article><article><span>Ambiente</span><strong>Produção</strong></article><article><span>Banco</span><strong>Supabase conectado</strong></article><article><span>Última sincronização</span><strong>${escapeHtml(formatDateTime(settingsState.systemStats?.lastUpdated))}</strong></article><article><span>Backup</span><strong>Não configurado</strong></article></div><button class="button button--secondary" type="button" data-settings-clear-cache>Limpar cache local</button></section>`;
  const integrationCards = category === 'integrations' ? ['WhatsApp', 'Melhor Envio', 'Gateway Pix', 'Mercado Livre', 'Shopee', 'TikTok Shop'].map((name) => `<article class="settings-v2-integration"><span class="settings-v2-icon">${settingsIcon('plug')}</span><strong>${name}</strong><small>Integração em breve</small><button type="button" data-settings-user-coming-soon>Em breve</button></article>`).join('') : '';
  const notifications = category === 'notifications' ? ['Nova venda', 'Novo pedido online', 'Pagamento aprovado', 'Pedido enviado', 'Estoque crítico', 'Despesa vencida', 'Erro de integração'].map((name) => `<label class="settings-v2-toggle"><input type="checkbox" disabled /> ${name}<small>Requer integração</small></label>`).join('') : '';
  const security = category === 'security' ? `<section class="settings-v2-block"><h3>Alterar senha</h3><button class="button button--secondary" type="button" data-settings-user-coming-soon>Enviar recuperação de senha</button><p class="muted-text">Autenticação em dois fatores e logs de acesso estarão disponíveis futuramente.</p></section>` : '';
  return `<section class="settings-v2-placeholder"><h3>${content[0]}</h3><p>${content[1]}</p>${integrationCards ? `<div class="settings-v2-integrations">${integrationCards}</div>` : ''}${notifications ? `<section class="settings-v2-block">${notifications}</section>` : ''}${security}</section>`;
}

function renderSettingsCategory(category) {
  const meta = settingsCategories.find(([id]) => id === category);
  const title = meta?.[1] || 'Configurações';
  const description = meta?.[2] || '';
  let body = '';
  if (category === 'company') body = `<div class="settings-v2-company"><nav>${[['general', 'Dados gerais'], ['address', 'Endereço'], ['contacts', 'Contatos'], ['fiscal', 'Informações fiscais'], ['additional', 'Informações adicionais']].map(([id, label]) => `<button type="button" data-settings-company-section="${id}" class="${settingsState.companySection === id ? 'is-active' : ''}">${escapeHtml(label)}</button>`).join('')}</nav><div>${renderCompanyV2()}</div></div>`;
  else if (category === 'branding') body = renderBrandingV2();
  else if (category === 'users') body = renderUsersV2();
  else if (category === 'printing') body = renderPrintingV2();
  else body = renderPlaceholderSettings(category);
  const formId = { company: 'settings-company-form', branding: 'settings-branding-form', printing: 'settings-printing-form', operation: 'settings-operation-form' }[category];
  return `<section class="module-panel settings-v2 settings-v2--detail"><header class="settings-v2__header"><div><button class="settings-v2-back" type="button" data-settings-home>${settingsIcon('arrow')} Voltar</button><nav class="settings-v2-breadcrumb"><button type="button" data-settings-home>Configurações</button><span>${escapeHtml(title)}</span></nav><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${formId ? `<button class="button button--primary" type="submit" form="${formId}" data-settings-save disabled>${settingsIcon('save')} Salvar alterações</button>` : ''}</header>${body}</section>`;
}

async function renderSettingsV2(container) {
  if (settingsState.view === 'hub') {
    await loadSystemStats();
    container.innerHTML = renderSettingsHub(settingsState.systemStats);
    return;
  }
  if (settingsState.category === 'users' && !settingsState.users.length) settingsState.users = await safeQuerySettingsUsers();
  if (settingsState.category === 'system') await loadSystemStats();
  container.innerHTML = renderSettingsCategory(settingsState.category);
}

async function safeQuerySettingsUsers() {
  const { data, error } = await supabase.from('profiles').select('*').order('name', { ascending: true });
  if (error) { console.warn('Não foi possível carregar usuários:', error.message); return []; }
  return data || [];
}

function renderUserFormModal() {
  return `<div class="modal-backdrop settings-user-modal-backdrop" data-settings-user-modal><section class="modal modal--narrow settings-user-modal" role="dialog" aria-modal="true" aria-labelledby="settings-user-form-title"><button class="modal-close" type="button" aria-label="Fechar" data-settings-user-close>×</button><header><p class="eyebrow">CONFIGURAÇÕES</p><h3 id="settings-user-form-title">Novo usuário</h3><p>Crie um acesso com usuário e senha próprios.</p></header><form data-settings-create-user><div class="form-grid"><label class="form-field form-field--full"><span>Nome completo</span><input name="name" autocomplete="name" required /></label><label class="form-field"><span>Usuário</span><input name="username" autocomplete="username" placeholder="ex.: joao.silva" pattern="[a-zA-Z0-9._-]{3,32}" required /></label><label class="form-field"><span>Perfil</span><select name="role"><option value="seller">Vendedor</option><option value="admin">Administrador</option></select></label><label class="form-field form-field--full"><span>Senha inicial</span><input name="password" type="password" minlength="8" autocomplete="new-password" required /></label></div><p class="form-message" data-settings-user-message></p><footer><button class="button button--secondary" type="button" data-settings-user-close>Cancelar</button><button class="button button--primary" type="submit">Criar usuário</button></footer></form></section></div>`;
}

function renderUserEditModal(user) {
  const isCurrentUser = user.id === settingsState.profile?.id;
  return `<div class="modal-backdrop settings-user-modal-backdrop" data-settings-user-modal><section class="modal modal--narrow settings-user-modal" role="dialog" aria-modal="true" aria-labelledby="settings-user-edit-title"><button class="modal-close" type="button" aria-label="Fechar" data-settings-user-close>×</button><header><p class="eyebrow">CONFIGURAÇÕES</p><h3 id="settings-user-edit-title">Editar usuário</h3><p>Atualize acesso e permissões com segurança.</p></header><form data-settings-edit-user data-user-id="${escapeHtml(user.id)}"><div class="form-grid"><label class="form-field form-field--full"><span>Nome completo</span><input name="name" value="${escapeHtml(user.name || '')}" required /></label><label class="form-field"><span>Usuário</span><input value="${escapeHtml(user.username || user.email || 'Conta antiga por e-mail')}" disabled /></label><label class="form-field"><span>Perfil</span><select name="role" ${isCurrentUser ? 'disabled' : ''}><option value="seller" ${user.role === 'seller' ? 'selected' : ''}>Vendedor</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option></select></label><label class="settings-v2-toggle form-field--full"><input name="active" type="checkbox" ${user.active !== false ? 'checked' : ''} ${isCurrentUser ? 'disabled' : ''} /> Usuário ativo</label></div>${isCurrentUser ? '<p class="muted-text">Sua própria conta não pode ser desativada ou rebaixada.</p>' : ''}<p class="form-message" data-settings-user-message></p><footer><button class="button button--secondary" type="button" data-settings-user-close>Cancelar</button><button class="button button--secondary" type="button" data-settings-open-password-reset="${escapeHtml(user.id)}">Redefinir senha</button><button class="button button--primary" type="submit">Salvar usuário</button></footer></form></section></div>`;
}

function renderPasswordResetModal(id) {
  return `<div class="modal-backdrop settings-user-modal-backdrop" data-settings-user-modal><section class="modal modal--narrow settings-user-modal" role="dialog" aria-modal="true" aria-labelledby="settings-password-reset-title"><button class="modal-close" type="button" aria-label="Fechar" data-settings-user-close>×</button><header><p class="eyebrow">SEGURANÇA</p><h3 id="settings-password-reset-title">Redefinir senha</h3><p>A nova senha será aplicada imediatamente e não será armazenada no sistema.</p></header><form data-settings-reset-password data-user-id="${escapeHtml(id)}"><label class="form-field"><span>Nova senha</span><input name="password" type="password" minlength="8" autocomplete="new-password" required /></label><label class="form-field"><span>Confirmar nova senha</span><input name="password_confirmation" type="password" minlength="8" autocomplete="new-password" required /></label><p class="form-message" data-settings-user-message></p><footer><button class="button button--secondary" type="button" data-settings-user-close>Cancelar</button><button class="button button--primary" type="submit">Confirmar redefinição</button></footer></form></section></div>`;
}

async function createSettingsUser(form) {
  const message = form.querySelector('[data-settings-user-message]');
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const username = String(formData.get('username') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!name || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error('Use de 3 a 32 caracteres: letras, números, ponto, hífen ou underline.');
  if (password.length < 8) throw new Error('A senha inicial deve ter pelo menos 8 caracteres.');
  message.textContent = 'Criando usuário...';
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'create', name, username, password, role: formData.get('role') },
  });
  if (error) throw new Error(await getEdgeFunctionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data?.user;
}

async function getEdgeFunctionErrorMessage(error) {
  const response = error?.context;
  if (response && typeof response.json === 'function') {
    try {
      const body = await response.clone().json();
      if (body?.error) return body.error;
    } catch {
      // The function may not return JSON for infrastructure failures.
    }
  }
  return error?.message || 'Não foi possível chamar o serviço de usuários.';
}

async function invokeAdminUsers(action, body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, ...body } });
  if (error) throw new Error(await getEdgeFunctionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

function getSettingsCategoryFromHash() {
  const query = window.location.hash.split('?')[1] || '';
  const category = new URLSearchParams(query).get('section');
  return settingsCategories.some(([id]) => id === category) ? category : null;
}

function navigateSettings(category = null) {
  settingsState.dirty = false;
  window.location.hash = category ? `#/configuracoes?section=${category}` : '#/configuracoes';
}

function setSettingsDirty(container, dirty = true) {
  settingsState.dirty = dirty;
  const save = container.querySelector('[data-settings-save]');
  if (save) save.disabled = !dirty;
}

function bindSettingsV2Events(container) {
  const signal = settingsState.abortController.signal;

  container.addEventListener('click', (event) => {
    const category = event.target.closest('[data-settings-category]')?.dataset.settingsCategory;
    if (category) {
      navigateSettings(category);
      return;
    }
    if (event.target.closest('[data-settings-home]')) {
      navigateSettings();
      return;
    }
    const section = event.target.closest('[data-settings-company-section]')?.dataset.settingsCompanySection;
    if (section) {
      settingsState.companySection = section;
      renderSettingsV2(container);
      return;
    }
    if (event.target.closest('[data-settings-clear-cache]')) {
      Object.keys(localStorage).filter((key) => key.startsWith('vb-')).forEach((key) => localStorage.removeItem(key));
      window.vbAdminToast?.('Cache local do Veste Bem foi limpo.');
      return;
    }
    if (event.target.closest('[data-settings-new-user]')) {
      document.body.insertAdjacentHTML('beforeend', renderUserFormModal());
      document.querySelector('[data-settings-create-user] input[name="name"]')?.focus();
      return;
    }
    const editId = event.target.closest('[data-settings-user-edit]')?.dataset.settingsUserEdit;
    if (editId) {
      const user = settingsState.users.find((item) => item.id === editId);
      if (user) document.body.insertAdjacentHTML('beforeend', renderUserEditModal(user));
      return;
    }
    const resetId = event.target.closest('[data-settings-open-password-reset]')?.dataset.settingsOpenPasswordReset;
    if (resetId) {
      document.querySelector('[data-settings-user-modal]')?.remove();
      document.body.insertAdjacentHTML('beforeend', renderPasswordResetModal(resetId));
      return;
    }
    if (event.target.closest('[data-settings-user-close]')) {
      document.querySelector('[data-settings-user-modal]')?.remove();
      return;
    }
    if (event.target.closest('[data-settings-user-coming-soon]')) {
      window.vbAdminToast?.('Este recurso depende de uma integração que ainda não está configurada.', 'warning');
    }
  }, { signal });

  container.addEventListener('input', (event) => {
    if (event.target.closest('[data-settings-form]')) setSettingsDirty(container);
  }, { signal });

  container.addEventListener('change', (event) => {
    if (event.target.closest('[data-settings-form]')) setSettingsDirty(container);
  }, { signal });

  container.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-settings-form]');
    if (!form) return;
    event.preventDefault();
    const save = container.querySelector('[data-settings-save]');
    if (save) save.disabled = true;
    await submitSettingsForm(container, form);
  }, { signal });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-settings-create-user]');
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const message = form.querySelector('[data-settings-user-message]');
    submit.disabled = true;
    try {
      await createSettingsUser(form);
      document.querySelector('[data-settings-user-modal]')?.remove();
      settingsState.users = await safeQuerySettingsUsers();
      await renderSettingsV2(container);
      window.vbAdminToast?.('Usuário criado com sucesso.');
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
    }
  }, { signal });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-settings-edit-user], [data-settings-reset-password]');
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const message = form.querySelector('[data-settings-user-message]');
    const formData = new FormData(form);
    submit.disabled = true;
    try {
      if (form.matches('[data-settings-edit-user]')) {
        await invokeAdminUsers('update', {
          id: form.dataset.userId,
          name: String(formData.get('name') || '').trim(),
          role: formData.get('role') || settingsState.users.find((user) => user.id === form.dataset.userId)?.role,
          active: form.querySelector('[name="active"]')?.checked === true,
        });
        window.vbAdminToast?.('Usuário atualizado com sucesso.');
      } else {
        const password = String(formData.get('password') || '');
        if (password !== String(formData.get('password_confirmation') || '')) throw new Error('As senhas não coincidem.');
        if (password.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
        await invokeAdminUsers('reset_password', { id: form.dataset.userId, password });
        window.vbAdminToast?.('Senha redefinida com sucesso.');
      }
      document.querySelector('[data-settings-user-modal]')?.remove();
      settingsState.users = await safeQuerySettingsUsers();
      await renderSettingsV2(container);
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
    }
  }, { signal });
}

export async function renderSettings(container, route, context = {}) {
  settingsState.abortController?.abort();
  settingsState.abortController = new AbortController();
  settingsState.profile = context.profile;
  settingsState.activeTab = 'company';
  settingsState.category = getSettingsCategoryFromHash();
  settingsState.view = settingsState.category ? 'detail' : 'hub';
  settingsState.settings = [];
  settingsState.settingsByKey = new Map();
  settingsState.stockKey = 'stock';
  settingsState.ordersKey = 'orders';
  settingsState.systemStats = null;

  if (!isAdmin(context.profile)) {
    container.innerHTML = `
      <section class="module-panel" aria-labelledby="settings-title">
        <p class="eyebrow">${escapeHtml(route.label)}</p>
        <h2 id="settings-title">Acesso restrito</h2>
        <p class="module-panel__text">Configurações estão disponíveis apenas para administradores.</p>
      </section>
    `;
    return;
  }

  try {
    await loadSettingsData();
    await renderSettingsV2(container);
    bindSettingsV2Events(container);
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    container.innerHTML = `<section class="module-panel settings-v2"><p class="table-empty">Não foi possível carregar configurações: ${escapeHtml(error.message)}</p></section>`;
  }
}
