import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../permissions.js';
import { getBrandLogoSrc } from '../config/branding.js';
import { renderThermalReceipt, thermalReceiptFilename } from './thermalReceipt.js';

const sizesOrder = ['PP', 'P', 'M', 'G', 'GG'];
const SALES_PAGE_SIZE = 20;

const storeConfig = {
  store_name: 'Veste Bem',
  logo_url: '',
  whatsapp: '',
  instagram: '',
  phone: '',
  address: '',
  receipt_message: 'Obrigado pela preferência.',
};

const salesState = {
  profile: null,
  isAdmin: false,
  sales: [],
  saleItems: [],
  customers: [],
  products: [],
  cart: [],
  selectedCustomer: null,
  customerSearch: '',
  showCustomerForm: false,
  editingSale: null,
  viewingSale: null,
  receiptSale: null,
  cancellingSale: null,
  expandedProductId: null,
  selectedColorId: null,
  selectedVariationId: null,
  productSearch: '',
  itemQuantity: 1,
  filters: {
    search: '',
    customer: '',
    number: '',
    dateFrom: '',
    dateTo: '',
    payment: 'all',
    status: 'all',
  },
  currentPage: 1,
  discountType: 'value',
  discountValue: 0,
  fiscalRequested: false,
  fiscalDocument: '',
  fiscalNotes: '',
  abortController: null,
};

const paymentLabels = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  debit_card: 'Cartão Débito',
  credit_card: 'Cartão Crédito',
  bank_transfer: 'Transferência',
};

const statusLabels = {
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

function getCustomerInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'VB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getPaymentPresentation(method) {
  if (method === 'pix') return { icon: 'pix', className: 'sale-payment--pix' };
  if (method === 'cash') return { icon: 'cash', className: 'sale-payment--cash' };
  if (['card', 'debit_card', 'credit_card'].includes(method)) return { icon: 'card', className: 'sale-payment--card' };
  if (method === 'bank_transfer') return { icon: 'bank', className: 'sale-payment--transfer' };
  return { icon: 'wallet', className: 'sale-payment--other' };
}

function getPaginationPages(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const ordered = Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  return ordered.reduce((result, page, index) => {
    if (index && page - ordered[index - 1] > 1) result.push('ellipsis');
    result.push(page);
    return result;
  }, []);
}

function saleDrawerIcon(name, className = '') {
  const paths = {
    package: '<path d="m16.5 9.4-9-5.2"></path><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="M3.3 7 12 12l8.7-5"></path><path d="M12 22V12"></path>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    cart: '<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h8.86a2 2 0 0 0 1.96-1.6L21 7H5.12"></path>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4"></path><path d="M8 3v4"></path><path d="M3 11h18"></path>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"></rect><path d="M6 9a3 3 0 0 1-3 3"></path><path d="M18 9a3 3 0 0 0 3 3"></path><path d="M6 15a3 3 0 0 0-3-3"></path><path d="M18 15a3 3 0 0 1 3-3"></path><circle cx="12" cy="12" r="2.5"></circle>',
    pix: '<path d="m12 2.8 4.1 4.1L12 11 7.9 6.9 12 2.8Z" fill="currentColor" stroke="none"></path><path d="m17.1 7.9 4.1 4.1-4.1 4.1L13 12l4.1-4.1Z" fill="currentColor" stroke="none"></path><path d="m12 13 4.1 4.1L12 21.2l-4.1-4.1L12 13Z" fill="currentColor" stroke="none"></path><path d="m6.9 7.9 4.1 4.1-4.1 4.1L2.8 12l4.1-4.1Z" fill="currentColor" stroke="none"></path><rect x="9.15" y="9.15" width="5.7" height="5.7" rx="1" transform="rotate(45 12 12)" fill="#fff" stroke="none"></rect>',
    bank: '<path d="M3 10h18"></path><path d="M5 10v8"></path><path d="M9 10v8"></path><path d="M15 10v8"></path><path d="M19 10v8"></path><path d="M2 20h20"></path><path d="m12 3 9 5H3l9-5Z"></path>',
    chevronLeft: '<path d="m15 18-6-6 6-6"></path>',
    chevronRight: '<path d="m9 18 6-6-6-6"></path>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"></rect><path d="M2 10h20"></path>',
    wallet: '<path d="M19 7V5.5A2.5 2.5 0 0 0 16.5 3h-11A2.5 2.5 0 0 0 3 5.5v13A2.5 2.5 0 0 0 5.5 21h13A2.5 2.5 0 0 0 21 18.5v-8A2.5 2.5 0 0 0 18.5 8H6"></path><path d="M16 14h.01"></path><path d="M3 6.5h13"></path>',
    info: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path>',
    printer: '<path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v8H6z"></path>',
    download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M9 15h6"></path>',
    badge: '<path d="M7 10h10"></path><path d="M7 14h10"></path><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M8 4v16"></path>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="3.5"></circle><path d="M17.5 6.5h.01"></path>',
    mapPin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>',
    arrowLeft: '<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>',
    check: '<path d="m20 6-11 11-5-5"></path>',
    more: '<circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>',
    whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"></path><path d="M9.5 8.8c.2 2.3 1.7 4.1 4 4.8l1.1-1.1 1.8.6c.2.1.3.3.3.5-.1.8-.7 1.5-1.5 1.6-3.8-.1-7-3.1-7.4-6.8.1-.8.8-1.4 1.6-1.5.2 0 .4.1.5.3l.7 1.6-1.1 1Z"></path>',
    edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>',
  };
  return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">${paths[name] || paths.info}</svg>`;
}

function showSalesToast(message, tone = 'success') {
  if (window.vbAdminToast) {
    window.vbAdminToast(message, tone);
    return;
  }

  let region = document.querySelector('[data-toast-region]');
  if (!region) {
    region = document.createElement('div');
    region.className = 'ds-toast-region';
    region.setAttribute('data-toast-region', '');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }

  const toast = document.createElement('article');
  toast.className = `ds-toast ds-toast--${tone}`;
  toast.innerHTML = `<span class="ds-toast__icon" aria-hidden="true">${tone === 'danger' ? '!' : '✓'}</span><div><strong>${escapeHtml(message)}</strong></div>`;
  region.appendChild(toast);
  window.requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 180);
  }, 3000);
}

function getSaleEditIdFromHash() {
  const hash = window.location.hash || '';
  const query = hash.split('?')[1] || '';
  const params = new URLSearchParams(query);
  return params.get('edit');
}

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

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function parseNumber(value) {
  const raw = String(value || '0').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
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

function formatSaleOperationNumber(sale) {
  const number = sale?.formatted_operation_number || String(sale?.operation_number || '').padStart(5, '0');
  return number && number !== '00000' ? `VD-${number}` : 'VD-00000';
}

function getDefaultCustomer() {
  return salesState.customers.find((customer) => customer.is_default)
    || salesState.customers.find((customer) => normalize(customer.name) === 'cliente diversos')
    || null;
}

function getOriginalSaleQuantity(variationId) {
  if (!salesState.editingSale) return 0;
  return getSaleItems(salesState.editingSale.id)
    .filter((item) => item.variation_id === variationId)
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function getAvailableQuantity(variation) {
  if (!variation) return 0;
  return Number(variation.quantity || 0) + getOriginalSaleQuantity(variation.id);
}

function stripLegacyInternalNotes(value) {
  return String(value || '')
    .split('\n')
    .filter((line) => {
      const normalizedLine = normalize(line);
      return !normalizedLine.startsWith('forma selecionada:')
        && !normalizedLine.startsWith('tipo de desconto:')
        && !normalizedLine.startsWith('valor informado do desconto:')
        && !normalizedLine.includes('auditoria desconto')
        && !normalizedLine.includes('todo');
    })
    .join('\n')
    .trim();
}

function parseSaleNotes(notes) {
  const text = String(notes || '').trim();
  const result = {
    observations: stripLegacyInternalNotes(text),
    fiscalRequested: false,
    fiscalDocument: '',
    fiscalNotes: '',
  };

  if (!text.includes('[Observações]') && !text.includes('[Fiscal]')) {
    return result;
  }

  const observationsMatch = text.match(/\[Observações\]\n([\s\S]*?)(?:\n\[[^\]]+\]|$)/);
  const fiscalSection = text.match(/\[Fiscal\]\n([\s\S]*)$/)?.[1] || '';

  result.observations = observationsMatch?.[1]?.trim() || '';
  result.fiscalRequested = /Nota fiscal solicitada:\s*Sim/i.test(fiscalSection);
  result.fiscalDocument = fiscalSection.match(/CPF\/CNPJ para NF:\s*(.*)/)?.[1]?.trim() || '';
  result.fiscalNotes = fiscalSection.match(/Observações fiscais:\s*([\s\S]*)/)?.[1]?.trim() || '';
  if (result.observations === '-') result.observations = '';
  if (result.fiscalDocument === '-') result.fiscalDocument = '';
  if (result.fiscalNotes === '-') result.fiscalNotes = '';

  return result;
}

function buildSaleNotes(form) {
  const observations = nullableText(form.elements.sale_notes?.value) || '';
  const fiscalRequested = form.elements.invoice_requested?.value === 'yes';
  const fiscalDocument = fiscalRequested ? nullableText(form.elements.fiscal_document?.value) || '' : '';
  const fiscalNotes = fiscalRequested ? nullableText(form.elements.fiscal_notes?.value) || '' : '';

  return [
    '[Observações]',
    observations || '-',
    '',
    '[Fiscal]',
    `Nota fiscal solicitada: ${fiscalRequested ? 'Sim' : 'Não'}`,
    `CPF/CNPJ para NF: ${fiscalDocument || '-'}`,
    `Observações fiscais: ${fiscalNotes || '-'}`,
  ].join('\n');
}

function isInvoiceRequested(sale) {
  return Boolean(sale?.invoice_requested || parseSaleNotes(sale?.notes).fiscalRequested);
}

function getSaleItems(saleId) {
  return salesState.saleItems.filter((item) => item.sale_id === saleId);
}

function getSaleCustomer(sale) {
  return salesState.customers.find((customer) => customer.id === sale?.customer_id) || null;
}

function getStoreLogoMarkup(variant = 'screen') {
  const fallback = variant === 'thermal' ? getBrandLogoSrc('icon') : getBrandLogoSrc('dark');
  const src = variant === 'thermal' ? (storeConfig.logo_url || fallback) : fallback;
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(storeConfig.store_name)}" />`;
}

async function loadStoreConfig() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'company')
      .maybeSingle();

    if (error) throw error;

    const company = data?.value || {};
    storeConfig.store_name = company.name || company.trade_name || storeConfig.store_name;
    storeConfig.logo_url = company.logo_url || '';
    storeConfig.whatsapp = company.whatsapp || '';
    storeConfig.instagram = company.instagram || '';
    storeConfig.phone = company.phone || '';
    storeConfig.address = company.address || '';
  } catch (error) {
    console.warn('Configuração da loja não disponível para recibos:', error.message);
  }
}

function getStoreContactMarkup() {
  return [
    storeConfig.whatsapp ? `WhatsApp: ${storeConfig.whatsapp}` : '',
    storeConfig.instagram ? `Instagram: ${storeConfig.instagram}` : '',
    storeConfig.phone ? `Telefone: ${storeConfig.phone}` : '',
    storeConfig.address || '',
  ].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
}

function getStoreAddressParts() {
  const address = String(storeConfig.address || '').trim();
  if (!address) return ['Shopping Via Norte', 'Rua 300 - Goiânia/GO'];
  const parts = address.split(/[,|]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length <= 1) return [address, ''];
  return [parts[0], parts.slice(1).join(' - ')];
}

function getReceiptData(sale) {
  const customer = getSaleCustomer(sale);
  const fiscal = parseSaleNotes(sale.notes);
  return {
    sale,
    customer,
    items: getSaleItems(sale.id),
    fiscal,
    invoiceRequested: isInvoiceRequested(sale),
    observations: fiscal.observations,
    number: formatSaleOperationNumber(sale),
    payment: paymentLabels[sale.payment_method] || sale.payment_method || '-',
    store: {
      name: storeConfig.store_name,
      logo: getBrandLogoSrc('dark'),
      whatsapp: storeConfig.whatsapp,
      instagram: storeConfig.instagram,
      phone: storeConfig.phone,
      address: storeConfig.address,
    },
  };
}

function renderReceipt(data, variant = 'screen') {
  const { sale, customer, items, fiscal, invoiceRequested, observations, number, payment } = data;
  const printCompact = variant === 'thermal';
  const storeAddress = getStoreAddressParts();
  const receiptDate = sale.created_at ? new Date(sale.created_at).toLocaleDateString('pt-BR') : '-';
  const receiptTime = sale.created_at ? new Date(sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
  const visibleItems = items;

  return `
    <article class="sale-receipt sale-receipt--${variant}">
      <header class="sale-receipt__header">
        <div class="sale-receipt__logo-block">
          <div class="sale-receipt__logo">${getStoreLogoMarkup(variant)}</div>
        </div>
        <div class="sale-receipt__title-block">
          <h3>RECIBO DE VENDA</h3>
        </div>
        <div class="sale-receipt__number-card">
          <strong>${escapeHtml(number)}</strong>
          <span>${escapeHtml(receiptDate)} ${saleDrawerIcon('clock')} ${escapeHtml(receiptTime)}</span>
        </div>
      </header>

      <section class="sale-receipt__cards">
        <div>${saleDrawerIcon('user')}<span>Cliente</span><strong>${escapeHtml(sale.customer_name || customer?.name || '-')}</strong></div>
        <div>${saleDrawerIcon('whatsapp')}<span>WhatsApp</span><strong>${escapeHtml(customer?.whatsapp || '-')}</strong></div>
        <div>${saleDrawerIcon('card')}<span>Pagamento</span><strong>${escapeHtml(payment)}</strong></div>
        <div>${saleDrawerIcon('file')}<span>NF solicitada</span><strong>${invoiceRequested ? 'Sim' : 'Não'}</strong></div>
        <div>${saleDrawerIcon('badge')}<span>CPF/CNPJ utilizado</span><strong>${escapeHtml(fiscal.fiscalDocument || '-')}</strong></div>
      </section>

      <section class="sale-receipt__section">
        <table class="sale-receipt__items">
          <thead>
            <tr>
              <th>Produto</th>
              ${printCompact ? '' : '<th>Cor</th><th>Tamanho</th>'}
              <th>Qtd</th>
              <th>Valor unit.</th>
              ${printCompact ? '' : '<th>Subtotal</th>'}
            </tr>
          </thead>
          <tbody>
            ${visibleItems.map((item) => `
              <tr>
                <td>
                  <strong>${escapeHtml(item.product_name)}</strong>
                  ${printCompact ? `<small>${escapeHtml(item.color)} / ${escapeHtml(item.size)}</small>` : ''}
                </td>
                ${printCompact ? '' : `<td>${escapeHtml(item.color)}</td><td>${escapeHtml(item.size)}</td>`}
                <td>${Number(item.quantity || 0)}</td>
                <td>${currency(item.unit_price)}</td>
                ${printCompact ? '' : `<td>${currency(item.subtotal)}</td>`}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${visibleItems.length > 6 ? '<p class="sale-receipt__continuation">Continuação dos itens</p>' : ''}
      </section>

      <section class="sale-receipt__totals">
        <div class="sale-receipt__totals-list">
          <div><span>Subtotal</span><strong>${currency(sale.gross_total)}</strong></div>
          <div><span>Desconto</span><strong>${currency(sale.discount)}</strong></div>
          <div class="sale-receipt__total-line"><span>Total</span><strong>${currency(sale.net_total)}</strong></div>
        </div>
        <div class="sale-receipt__paid-card">
          ${saleDrawerIcon('wallet')}
          <span>VALOR TOTAL PAGO</span>
          <strong>${currency(sale.net_total)}</strong>
        </div>
      </section>

      <section class="sale-receipt__thanks">
        ${saleDrawerIcon('heart')}
        <div>
          <strong>Obrigado pela preferência!</strong>
          <span>Sua satisfação é o que nos motiva a entregar sempre o melhor.</span>
        </div>
        <b aria-hidden="true">VB</b>
      </section>

      ${observations || fiscal.fiscalNotes ? `
        <section class="sale-receipt__notes">
          <strong>Observações fiscais</strong>
          <span>${escapeHtml(fiscal.fiscalNotes || observations || '-')}</span>
        </section>
      ` : ''}

      <footer class="sale-receipt__footer">
        <div>${saleDrawerIcon('whatsapp')}<span>WhatsApp</span><strong>${escapeHtml(storeConfig.whatsapp || storeConfig.phone || '-')}</strong></div>
        <div>${saleDrawerIcon('instagram')}<span>Instagram</span><strong>${escapeHtml(storeConfig.instagram || '@vbmodaalfaiataria')}</strong></div>
        <div>${saleDrawerIcon('mapPin')}<span>${escapeHtml(storeAddress[0])}</span><strong>${escapeHtml(storeAddress[1] || '-')}</strong></div>
      </footer>
      <p class="sale-receipt__fiscal-note">Este documento não possui valor fiscal.</p>
    </article>
  `;
}

function calculateCartTotals() {
  const subtotal = salesState.cart.reduce((total, item) => total + item.subtotal, 0);
  let discount = 0;

  if (salesState.discountType === 'percent') {
    discount = subtotal * (Math.min(Math.max(salesState.discountValue, 0), 100) / 100);
  } else {
    discount = Math.max(salesState.discountValue, 0);
  }

  discount = Math.min(discount, subtotal);

  return {
    subtotal,
    discount,
    total: subtotal - discount,
  };
}

function getFilteredSales() {
  const search = normalize(salesState.filters.search);
  const customer = normalize(salesState.filters.customer);
  const number = normalize(salesState.filters.number);
  const dateFrom = salesState.filters.dateFrom ? new Date(`${salesState.filters.dateFrom}T00:00:00`) : null;
  const dateTo = salesState.filters.dateTo ? new Date(`${salesState.filters.dateTo}T23:59:59`) : null;

  return salesState.sales.filter((sale) => {
    const saleDate = sale.created_at ? new Date(sale.created_at) : null;
    const matchesCustomer = !customer || normalize(sale.customer_name).includes(customer);
    const matchesNumber = !number || String(sale.operation_number || '').includes(number) || normalize(sale.formatted_operation_number).includes(number);
    const searchable = normalize(`${formatSaleOperationNumber(sale)} ${sale.customer_name || ''} ${getSaleItems(sale.id).map((item) => item.product_name).join(' ')}`);
    const matchesSearch = !search || searchable.includes(search);
    const matchesPayment = salesState.filters.payment === 'all' || sale.payment_method === salesState.filters.payment;
    const matchesStatus = salesState.filters.status === 'all' || sale.status === salesState.filters.status;
    const matchesFrom = !dateFrom || (saleDate && saleDate >= dateFrom);
    const matchesTo = !dateTo || (saleDate && saleDate <= dateTo);
    return matchesSearch && matchesCustomer && matchesNumber && matchesPayment && matchesStatus && matchesFrom && matchesTo;
  });
}

function getHashParams() {
  const query = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(query);
}

function showSalesNotice(container, message) {
  const list = container.querySelector('[data-sales-list]');
  if (!list || !message) return;
  list.insertAdjacentHTML('beforebegin', `<p class="form-message form-message--route">${escapeHtml(message)}</p>`);
}

function openRequestedSaleFromHash(container) {
  const params = getHashParams();
  const saleId = params.get('saleId') || params.get('sale');
  if (!saleId) return;

  const sale = salesState.sales.find((item) => item.id === saleId);
  if (!sale) {
    showSalesNotice(container, 'Venda não encontrada ou indisponível para este perfil.');
    return;
  }

  openSaleDetails(container, sale.id);
}

async function loadCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, whatsapp, email, city, cpf, notes, is_default')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function loadAdminProducts() {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, description, sku, image_url, sale_price, status')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (productsError) throw productsError;

  const productIds = (products || []).map((product) => product.id);
  if (!productIds.length) return [];

  const { data: colors, error: colorsError } = await supabase
    .from('product_colors')
    .select('id, product_id, color_name, image_url, active')
    .in('product_id', productIds)
    .eq('active', true)
    .order('color_name', { ascending: true });

  if (colorsError) throw colorsError;

  const { data: variations, error: variationsError } = await supabase
    .from('product_variations')
    .select('id, product_id, product_color_id, size, quantity, status')
    .in('product_id', productIds)
    .eq('status', 'active');

  if (variationsError) throw variationsError;

  return composeProducts(products || [], colors || [], variations || []);
}

async function loadSellerProducts() {
  const { data: products, error: productsError } = await supabase
    .from('vw_products_seller')
    .select('id, name, description, sku, image_url, sale_price, status, color_images')
    .order('name', { ascending: true });

  if (productsError) throw productsError;

  const { data: stockRows, error: stockError } = await supabase
    .from('vw_stock_seller')
    .select('variation_id, product_id, product_color_id, color_name, color_image_url, color_active, size, quantity, variation_status');

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
      status: variation.status,
    });
  });

  return products.map((product) => ({
    ...product,
    sale_price: Number(product.sale_price || 0),
    colors: colorsByProduct.get(product.id) || [],
  }));
}

function composeSellerProducts(products, stockRows) {
  const productsById = new Map();

  products.forEach((product) => {
    const colors = Array.isArray(product.color_images) ? product.color_images : [];
    productsById.set(product.id, {
      ...product,
      sale_price: Number(product.sale_price || 0),
      colors: colors.map((color) => ({
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
      status: row.variation_status,
    });
  });

  return [...productsById.values()];
}

async function loadSales() {
  const { data: sales, error: salesError } = await supabase
    .from('vw_sales_seller')
    .select('*')
    .order('created_at', { ascending: false });

  if (salesError) throw salesError;

  let saleItems = [];
  const saleIds = (sales || []).map((sale) => sale.id);

  if (saleIds.length) {
    const { data, error } = await supabase
      .from('sale_items')
      .select('id, sale_id, product_id, variation_id, product_name, color, size, quantity, unit_price, subtotal')
      .in('sale_id', saleIds);

    if (!error) {
      saleItems = data || [];
    } else {
      console.warn('Itens de venda não disponíveis para este perfil/RLS:', error.message);
    }
  }

  salesState.sales = sales || [];
  salesState.saleItems = saleItems;
}

async function loadSalesData(container) {
  setSalesLoading(container);

  try {
    const [customers, products] = await Promise.all([
      loadCustomers(),
      salesState.isAdmin ? loadAdminProducts() : loadSellerProducts(),
      loadSales(),
      loadStoreConfig(),
    ]);
    salesState.customers = customers;
    salesState.products = products;
    const metrics = container.querySelector('[data-sales-metrics]');
    if (metrics) metrics.innerHTML = renderSalesMetrics();
    renderSalesList(container);
    openRequestedSaleFromHash(container);
  } catch (error) {
    console.error('Erro ao carregar vendas:', error);
    setSalesError(container, `Não foi possível carregar vendas: ${error.message}`);
    showSalesToast('Erro ao carregar vendas.', 'danger');
  }
}

function renderSalesLayout(container, route) {
  container.innerHTML = `
    <section class="module-panel sales-module sales-v2" aria-labelledby="sales-title">
      <div class="module-header sales-v2__header">
        <div>
          <h2 id="sales-title">${escapeHtml(route.title)}</h2>
          <p class="module-panel__text">Controle de vendas da loja. Visual premium para operação rápida, leitura limpa e acompanhamento claro.</p>
        </div>
        <div class="module-header__actions">
          <button class="ds-button ds-button--secondary" type="button">Importar</button>
          <button class="ds-button ds-button--secondary" type="button">Exportar</button>
          <button class="ds-button ds-button--secondary" type="button">Relatórios</button>
          <a class="ds-button ds-button--gold" href="#/vendas/nova">+ Nova Venda</a>
        </div>
      </div>

      <div class="sales-metrics" data-sales-metrics>${renderSalesMetrics()}</div>

      <form class="sales-v2-filters" data-sales-filters>
        <label class="ds-search sales-v2-filters__search">
          <span aria-hidden="true">⌕</span>
          <input type="search" name="search" placeholder="Buscar por venda, cliente ou telefone..." autocomplete="off" />
        </label>
        <label class="form-field sales-v2-filters__date">
          <span>Data inicial</span>
          <input type="date" name="date_from" />
        </label>
        <label class="form-field sales-v2-filters__date">
          <span>Data final</span>
          <input type="date" name="date_to" />
        </label>
        <label class="form-field">
          <span>Pagamento</span>
          <select name="payment">
            <option value="all">Todos</option>
            <option value="pix">Pix</option>
            <option value="cash">Dinheiro</option>
            <option value="card">Cartão</option>
          </select>
        </label>
        <label class="form-field">
          <span>Status</span>
          <select name="status">
            <option value="all">Todos</option>
            <option value="completed">Concluídas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>
        <button class="ds-button ds-button--secondary sales-v2-filters__today" type="button" data-sales-today>Hoje</button>
        <button class="ds-button ds-button--secondary sales-v2-filters__clear" type="button" data-sales-filters-clear>Limpar filtros</button>
      </form>

      <div data-sales-list>
        <p class="table-empty">Carregando vendas...</p>
      </div>
    </section>

    ${renderSaleModal()}
    ${renderSaleDetailsModal()}
    ${renderSaleReceiptModal()}
    ${renderSaleWhatsappModal()}
    ${renderSaleWhatsappSuccessModal()}
    ${renderCancelSaleModal()}
    <div class="sale-print-root" data-print-receipt aria-hidden="true"></div>
  `;
}

function renderSalesMetrics() {
  const today = new Date().toDateString();
  const completed = salesState.sales.filter((sale) => sale.status !== 'cancelled');
  const todaySales = completed.filter((sale) => new Date(sale.created_at).toDateString() === today);
  const monthSales = completed.filter((sale) => {
    const date = new Date(sale.created_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const todayRevenue = todaySales.reduce((total, sale) => total + Number(sale.net_total || 0), 0);
  const piecesToday = todaySales.reduce((total, sale) => total + getSaleItems(sale.id).reduce((sum, item) => sum + Number(item.quantity || 0), 0), 0);
  const uniqueCustomers = new Set(completed.map((sale) => sale.customer_id).filter(Boolean)).size;
  const ticket = todaySales.length ? todayRevenue / todaySales.length : 0;
  return `
    <article class="sales-metric" data-icon="⟡"><span>Vendas hoje</span><strong>${todaySales.length}</strong><small>operações concluídas</small></article>
    <article class="sales-metric sales-metric--gold" data-icon="R$"><span>Faturamento hoje</span><strong>${currency(todayRevenue)}</strong><small>valor líquido</small></article>
    <article class="sales-metric" data-icon="⌖"><span>Ticket médio</span><strong>${currency(ticket)}</strong><small>média de hoje</small></article>
    <article class="sales-metric" data-icon="◎"><span>Peças vendidas</span><strong>${piecesToday}</strong><small>${monthSales.length} vendas no período</small></article>
    <article class="sales-metric" data-icon="◌"><span>Clientes atendidos</span><strong>${uniqueCustomers}</strong><small>base ativa</small></article>
  `;
}

function renderSaleModal() {
  return `
    <div class="modal-backdrop" data-sale-modal hidden>
      <section class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="sale-modal-title">
        <form data-sale-form>
          <div class="modal__header">
            <div>
              <p class="eyebrow">Vendas</p>
              <h3 id="sale-modal-title">Nova Venda</h3>
            </div>
            <button class="icon-button" type="button" data-close-sale-modal aria-label="Fechar">×</button>
          </div>

          <div class="sale-form-layout">
            <section class="sale-form-section">
              <div class="sale-section-header">
                <h4>Cliente</h4>
                <button class="button button--compact button--secondary" type="button" data-toggle-sale-customer-form>Novo Cliente</button>
              </div>
              <div data-sale-customer-area></div>
            </section>

            <section class="sale-form-section">
              <h4>Itens da venda</h4>
              <div class="form-grid sale-item-grid">
                <label class="form-field">
                  <span>Produto</span>
                  <select name="product_id" data-sale-product></select>
                </label>
                <label class="form-field">
                  <span>Cor</span>
                  <select name="color_id" data-sale-color></select>
                </label>
                <label class="form-field">
                  <span>Tamanho</span>
                  <select name="variation_id" data-sale-variation></select>
                </label>
                <label class="form-field">
                  <span>Quantidade</span>
                  <input name="quantity" type="number" min="1" step="1" value="1" />
                </label>
              </div>
              <div class="sale-inline-actions">
                <p class="muted-text" data-available-stock>Estoque disponível: 0</p>
                <button class="button button--secondary" type="button" data-add-sale-item>Adicionar item</button>
              </div>
            </section>

            <section class="sale-form-section">
              <h4>Carrinho</h4>
              <div data-sale-cart></div>
            </section>

            <section class="sale-form-section">
              <h4>Desconto</h4>
              <div class="sale-discount-grid">
                <div class="segmented-options">
                  <label><input type="radio" name="discount_type" value="value" checked /> Valor</label>
                  <label><input type="radio" name="discount_type" value="percent" /> Percentual</label>
                </div>
                <label class="form-field">
                  <span>Desconto</span>
                  <input name="discount_value" type="number" min="0" step="0.01" value="0" />
                </label>
              </div>
            </section>

            <section class="sale-form-section">
              <h4>Pagamento</h4>
              <label class="form-field">
                <span>Forma de pagamento</span>
                <select name="payment_method" required>
                  <option value="pix">Pix</option>
                  <option value="cash">Dinheiro</option>
                  <option value="debit_card">Cartão Débito</option>
                  <option value="credit_card">Cartão Crédito</option>
                  <option value="bank_transfer">Transferência</option>
                </select>
              </label>
              <label class="form-field">
                <span>Observações</span>
                <textarea name="sale_notes" rows="3" placeholder="Atendimento, retirada, entrega ou detalhes da venda"></textarea>
              </label>
              <div data-edit-reason-area hidden>
                <label class="form-field">
                  <span>Motivo da alteração</span>
                  <textarea name="edit_reason" rows="3" placeholder="Obrigatório para vendedor ao editar"></textarea>
                </label>
              </div>
            </section>

            <section class="sale-form-section">
              <h4>Fiscal</h4>
              <fieldset class="segmented-options sale-radio-group">
                <legend>Cliente solicitou Nota Fiscal?</legend>
                <label><input type="radio" name="invoice_requested" value="no" checked /> Não</label>
                <label><input type="radio" name="invoice_requested" value="yes" /> Sim</label>
              </fieldset>
              <div class="sale-fiscal-fields" data-sale-fiscal-fields hidden>
                <label class="form-field">
                  <span>CPF/CNPJ para NF</span>
                  <input name="fiscal_document" type="text" />
                </label>
                <label class="form-field">
                  <span>Observações fiscais</span>
                  <textarea name="fiscal_notes" rows="3"></textarea>
                </label>
              </div>
            </section>

            <section class="sale-form-section sale-form-section--summary">
              <h4>Resumo final</h4>
              <div class="sale-totals sale-totals--highlight" data-sale-totals></div>
            </section>
          </div>

          <p class="form-message" data-sale-message></p>

          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-close-sale-modal>Cancelar</button>
            <button class="button button--primary" type="submit">Finalizar Venda</button>
          </div>
        </form>
      </section>
    </div>
  `;
}
function renderSaleDetailsModal() {
  return `
    <div class="ds-drawer-backdrop sale-view-backdrop" data-sale-details-modal hidden>
      <section class="ds-drawer sale-drawer sale-view-drawer is-open" role="dialog" aria-modal="true" aria-labelledby="sale-details-title">
        <div class="sale-drawer__body">
          <div data-sale-details></div>
        </div>
        <div class="sale-drawer__footer">
          <button class="button button--secondary sale-view-action sale-view-action--edit" type="button" data-edit-sale-drawer>${saleDrawerIcon('edit')} Editar venda</button>
          <button class="button button--secondary sale-view-action sale-view-action--danger" type="button" data-open-cancel-sale>${saleDrawerIcon('trash')} Cancelar venda</button>
        </div>
      </section>
    </div>
  `;
}

function renderSaleReceiptModal() {
  return `
    <div class="ds-drawer-backdrop sale-view-backdrop" data-sale-receipt-modal hidden>
      <section class="ds-drawer sale-drawer sale-receipt-modal is-open" role="dialog" aria-modal="true" aria-labelledby="sale-receipt-title">
        <div class="sale-receipt-screen-header sale-print-ignore">
          <button class="sale-receipt-back" type="button" data-back-sale-details>${saleDrawerIcon('arrowLeft')} Voltar</button>
          <h3 id="sale-receipt-title">Recibo da venda</h3>
          <button class="sale-view-close" type="button" data-close-sale-receipt-modal aria-label="Fechar">×</button>
        </div>
        <div class="sale-drawer__body">
          <div data-sale-receipt></div>
          <p class="form-message sale-print-ignore" data-sale-receipt-message></p>
        </div>
        <div class="sale-drawer__footer sale-print-ignore">
          <button class="button button--secondary sale-view-action" type="button" data-print-sale="pdf">${saleDrawerIcon('download')} Baixar PDF</button>
          <button class="button button--primary sale-view-action sale-view-action--whatsapp" type="button" data-open-sale-whatsapp>${saleDrawerIcon('whatsapp')} Compartilhar no WhatsApp</button>
          <button class="button button--primary sale-view-action sale-view-action--print" type="button" data-print-sale="print">${saleDrawerIcon('printer')} Imprimir</button>
        </div>
      </section>
    </div>
  `;
}

function renderSaleWhatsappModal() {
  return `
    <div class="modal-backdrop sale-whatsapp-backdrop" data-sale-whatsapp-modal hidden>
      <section class="modal modal--premium sale-whatsapp-modal" role="dialog" aria-modal="true" aria-labelledby="sale-whatsapp-title">
        <div class="modal__header">
          <h3 id="sale-whatsapp-title">Enviar recibo via WhatsApp</h3>
          <button class="icon-button" type="button" data-close-sale-whatsapp-modal aria-label="Fechar">×</button>
        </div>
        <div class="sale-whatsapp-modal__body" data-sale-whatsapp-confirm></div>
      </section>
    </div>
  `;
}

function renderSaleWhatsappSuccessModal() {
  return `
    <div class="modal-backdrop sale-whatsapp-backdrop" data-sale-whatsapp-success-modal hidden>
      <section class="modal modal--premium sale-whatsapp-success" role="dialog" aria-modal="true" aria-labelledby="sale-whatsapp-success-title">
        <button class="icon-button sale-whatsapp-success__close" type="button" data-close-sale-whatsapp-success-modal aria-label="Fechar">×</button>
        <div class="sale-whatsapp-success__body" data-sale-whatsapp-success></div>
      </section>
    </div>
  `;
}

function renderCancelSaleModal() {
  return `
    <div class="modal-backdrop" data-cancel-sale-modal hidden>
      <section class="modal modal--premium" role="dialog" aria-modal="true" aria-labelledby="cancel-sale-title">
        <form data-cancel-sale-form>
          <div class="modal__header">
            <div>
              <p class="eyebrow">Atenção</p>
              <h3 id="cancel-sale-title">Cancelar venda?</h3>
            </div>
            <button class="icon-button" type="button" data-close-cancel-sale-modal aria-label="Fechar">×</button>
          </div>
          <p class="modal__text">O estoque será devolvido, o financeiro será atualizado e este cancelamento ficará registrado no histórico da venda.</p>
          <label class="form-field">
            <span>Motivo do cancelamento</span>
            <textarea name="cancel_reason" rows="3" required></textarea>
          </label>
          <p class="form-message" data-cancel-sale-message></p>
          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-close-cancel-sale-modal>Voltar</button>
            <button class="button button--danger" type="submit">Confirmar cancelamento</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function setSalesLoading(container) {
  const list = container.querySelector('[data-sales-list]');
  if (list) list.innerHTML = '<p class="table-empty">Carregando vendas...</p>';
}

function setSalesError(container, message) {
  const list = container.querySelector('[data-sales-list]');
  if (list) list.innerHTML = `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function renderSalesList(container) {
  const list = container.querySelector('[data-sales-list]');
  if (!list) return;

  const filteredSales = getFilteredSales();
  if (!filteredSales.length) {
    salesState.currentPage = 1;
    list.innerHTML = '<div class="ds-empty"><strong>Nenhuma venda encontrada.</strong><span>Use os filtros para localizar um registro ou crie uma nova venda.</span></div>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / SALES_PAGE_SIZE));
  salesState.currentPage = Math.min(Math.max(salesState.currentPage, 1), totalPages);
  const startIndex = (salesState.currentPage - 1) * SALES_PAGE_SIZE;
  const sales = filteredSales.slice(startIndex, startIndex + SALES_PAGE_SIZE);
  const endIndex = Math.min(startIndex + sales.length, filteredSales.length);
  const pages = getPaginationPages(salesState.currentPage, totalPages);

  list.innerHTML = `
    <div class="table-shell sales-list-shell">
      <div class="sales-list-table-scroll">
        <table class="data-table sales-table">
          <thead>
            <tr>
              <th>Venda</th>
              <th>Cliente</th>
              <th>Pagamento</th>
              <th>Valor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>${sales.map(renderSaleRow).join('')}</tbody>
        </table>
      </div>
      <footer class="sales-pagination" aria-label="Paginação das vendas">
        <p>Mostrando ${startIndex + 1}–${endIndex} de ${filteredSales.length} ${filteredSales.length === 1 ? 'venda' : 'vendas'}</p>
        <nav>
          <button class="ds-icon-button" type="button" data-sales-page="previous" aria-label="Página anterior" ${salesState.currentPage === 1 ? 'disabled' : ''}>${saleDrawerIcon('chevronLeft')}</button>
          ${pages.map((page) => page === 'ellipsis'
            ? '<span class="sales-pagination__ellipsis" aria-hidden="true">…</span>'
            : `<button class="sales-pagination__page${page === salesState.currentPage ? ' is-active' : ''}" type="button" data-sales-page="${page}" ${page === salesState.currentPage ? 'aria-current="page"' : ''}>${page}</button>`).join('')}
          <button class="ds-icon-button" type="button" data-sales-page="next" aria-label="Próxima página" ${salesState.currentPage === totalPages ? 'disabled' : ''}>${saleDrawerIcon('chevronRight')}</button>
        </nav>
      </footer>
    </div>
  `;
}

function renderSaleRow(sale) {
  const itemCount = getSaleItems(sale.id).reduce((total, item) => total + Number(item.quantity || 0), 0);
  const customerName = sale.customer_name || '-';
  const payment = getPaymentPresentation(sale.payment_method);
  return `
    <tr>
      <td data-label="Venda">
        <div class="sale-row-identity">
          <span class="sale-row-cart" aria-hidden="true">${saleDrawerIcon('cart')}</span>
          <div class="sale-row-sale">
            <strong>${escapeHtml(formatSaleOperationNumber(sale))}${isInvoiceRequested(sale) ? '<span class="sale-row-pill">NF</span>' : ''}</strong>
            <span class="sale-row-meta">${saleDrawerIcon('calendar')} ${escapeHtml(formatDate(sale.created_at))}</span>
            <small>${saleDrawerIcon('package')} ${itemCount || 0} ${itemCount === 1 ? 'peça' : 'peças'}</small>
          </div>
        </div>
      </td>
      <td data-label="Cliente">
        <div class="sale-row-client">
          <span class="sale-row-client__avatar" aria-hidden="true">${escapeHtml(getCustomerInitials(customerName))}</span>
          <span class="sale-row-client__text">
            <strong>${escapeHtml(customerName)}</strong>
            <small>${escapeHtml(sale.customer_whatsapp || '—')}</small>
          </span>
        </div>
      </td>
      <td data-label="Pagamento" class="sale-row-payment">
        <span class="sale-payment-badge ${sale.status === 'cancelled' ? 'sale-payment--cancelled' : payment.className}">${saleDrawerIcon(payment.icon)} ${escapeHtml(paymentLabels[sale.payment_method] || sale.payment_method || '-')}</span>
      </td>
      <td data-label="Valor">
        <strong class="sale-row-value">${currency(sale.net_total)}</strong>
      </td>
      <td data-label="Ações">
        <div class="sale-row-actions">
          <button class="ds-icon-button sale-row-actions__trigger" type="button" aria-label="Ações da venda" data-sale-actions-trigger="${sale.id}">•••</button>
          <div class="sale-row-actions__menu" data-sale-actions-menu="${sale.id}" hidden>
            <button type="button" data-view-sale="${sale.id}"><span aria-hidden="true">👁</span>Visualizar venda</button>
            ${canEditSale(sale) ? `<button type="button" data-edit-sale="${sale.id}"><span aria-hidden="true">✎</span>Editar venda</button>` : ''}
            ${sale.invoice_requested ? '' : `<button type="button" data-request-sale-invoice="${sale.id}"><span aria-hidden="true">◇</span>Solicitar nota fiscal</button>`}
            ${salesState.isAdmin && sale.status !== 'cancelled' ? `<button type="button" data-direct-cancel-sale="${sale.id}"><span aria-hidden="true">×</span>Cancelar</button>` : ''}
          </div>
        </div>
      </td>
    </tr>
  `;
}

function populateSaleForm(container) {
  const form = container.querySelector('[data-sale-form]');
  const productSelect = form.elements.product_id;

  productSelect.innerHTML = salesState.products.length
    ? salesState.products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)}</option>`).join('')
    : '<option value="">Nenhum produto ativo</option>';

  renderCustomerArea(container);
  updateColorOptions(container);
  renderCart(container);
}

function getCustomerSuggestions() {
  const search = normalize(salesState.customerSearch);
  const searchDigits = normalizeDigits(salesState.customerSearch);
  if (!search) return [];

  return salesState.customers
    .filter((customer) => {
      return normalize(customer.name).includes(search)
        || normalize(customer.whatsapp).includes(search)
        || normalize(customer.cpf).includes(search)
        || (searchDigits && normalizeDigits(customer.whatsapp).includes(searchDigits))
        || (searchDigits && normalizeDigits(customer.cpf).includes(searchDigits));
    })
    .slice(0, 6);
}

function renderCustomerArea(container) {
  if (container.querySelector('[data-new-sale-page]')) {
    renderPosCustomerArea(container);
    return;
  }
  const area = container.querySelector('[data-sale-customer-area]');
  if (!area) return;

  if (salesState.showCustomerForm) {
    area.innerHTML = renderInlineCustomerForm();
    return;
  }

  const selectedCustomer = salesState.selectedCustomer;
  const suggestions = getCustomerSuggestions();

  area.innerHTML = `
    ${selectedCustomer ? `
      <article class="sale-selected-customer">
        <span>Cliente Selecionado</span>
        <strong>${escapeHtml(selectedCustomer.name)}</strong>
        <small>WhatsApp: ${escapeHtml(selectedCustomer.whatsapp || '-')}</small>
        <small>Cidade: ${escapeHtml(selectedCustomer.city || '-')}</small>
        <button class="button button--compact button--secondary" type="button" data-clear-sale-customer>Trocar Cliente</button>
      </article>
    ` : `
      <label class="form-field">
        <span>Buscar cliente</span>
        <input name="customer_search" type="search" value="${escapeHtml(salesState.customerSearch)}" placeholder="Nome, WhatsApp ou CPF" autocomplete="off" data-sale-customer-search />
      </label>
      <div class="sale-customer-results">
        ${suggestions.length ? suggestions.map((customer) => `
          <button class="sale-customer-result" type="button" data-select-sale-customer="${customer.id}">
            <strong>${escapeHtml(customer.name)}</strong>
            <span>WhatsApp: ${escapeHtml(customer.whatsapp || '-')}</span>
            <span>CPF: ${escapeHtml(customer.cpf || '-')}</span>
            <span>Cidade: ${escapeHtml(customer.city || '-')}</span>
          </button>
        `).join('') : `
          <p class="muted-text">Digite para buscar. Se não selecionar, será usado Cliente Diversos automaticamente.</p>
        `}
      </div>
    `}
  `;
}

function renderInlineCustomerForm() {
  return `
    <div class="sale-inline-customer-form">
      <div class="sale-section-header">
        <h5>Novo cliente</h5>
        <button class="button button--compact button--secondary" type="button" data-cancel-sale-customer-form>Cancelar</button>
      </div>
      <div class="form-grid">
        <label class="form-field form-field--full">
          <span>Nome</span>
          <input name="new_customer_name" type="text" />
        </label>
        <label class="form-field">
          <span>WhatsApp</span>
          <input name="new_customer_whatsapp" type="text" />
        </label>
        <label class="form-field">
          <span>E-mail</span>
          <input name="new_customer_email" type="email" />
        </label>
        <label class="form-field">
          <span>Cidade</span>
          <input name="new_customer_city" type="text" />
        </label>
        <label class="form-field">
          <span>CPF opcional</span>
          <input name="new_customer_cpf" type="text" inputmode="numeric" />
        </label>
        <label class="form-field form-field--full">
          <span>Observações</span>
          <textarea name="new_customer_notes" rows="3"></textarea>
        </label>
      </div>
      <button class="button button--primary" type="button" data-save-sale-customer>Salvar cliente</button>
    </div>
  `;
}

function selectSaleCustomer(container, customerId) {
  salesState.selectedCustomer = salesState.customers.find((customer) => customer.id === customerId) || null;
  salesState.customerSearch = '';
  renderCustomerArea(container);
  autofillFiscalDocument(container);
}

function clearSaleCustomer(container) {
  salesState.selectedCustomer = null;
  salesState.customerSearch = '';
  renderCustomerArea(container);
}

function autofillFiscalDocument(container) {
  const form = container.querySelector('[data-sale-form]');
  if (!form || form.elements.invoice_requested?.value !== 'yes') return;
  const fiscalDocument = form.elements.fiscal_document;
  if (fiscalDocument && !fiscalDocument.value.trim() && salesState.selectedCustomer?.cpf) {
    fiscalDocument.value = salesState.selectedCustomer.cpf;
  }
}

function syncFiscalFields(container) {
  const form = container.querySelector('[data-sale-form]');
  const fields = container.querySelector('[data-sale-fiscal-fields]');
  if (!form || !fields) return;

  const requested = form.elements.invoice_requested?.value === 'yes';
  fields.hidden = !requested;
  if (requested) {
    autofillFiscalDocument(container);
  } else {
    form.elements.fiscal_document.value = '';
    form.elements.fiscal_notes.value = '';
  }
}

function nullableText(value) {
  const text = String(value || '').trim();
  return text || null;
}

async function saveInlineCustomer(container) {
  const form = container.querySelector('[data-sale-form]');
  const message = container.querySelector('[data-sale-message]');
  const payload = {
    name: nullableText(form.elements.new_customer_name?.value),
    whatsapp: nullableText(form.elements.new_customer_whatsapp?.value),
    email: nullableText(form.elements.new_customer_email?.value),
    city: nullableText(form.elements.new_customer_city?.value),
    cpf: nullableText(form.elements.new_customer_cpf?.value),
    notes: nullableText(form.elements.new_customer_notes?.value),
    is_default: false,
    created_by: salesState.profile?.id || null,
  };

  if (!payload.name) {
    message.textContent = 'Informe o nome do cliente.';
    return;
  }

  message.textContent = 'Salvando cliente...';

  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('id, name, whatsapp, email, city, cpf, notes, is_default')
    .single();

  if (error) {
    console.error('Erro ao criar cliente na venda:', error);
    message.textContent = `Erro ao criar cliente: ${error.message}`;
    return;
  }

  salesState.customers = [data, ...salesState.customers];
  salesState.selectedCustomer = data;
  salesState.showCustomerForm = false;
  salesState.customerSearch = '';
  message.textContent = '';
  renderCustomerArea(container);
  autofillFiscalDocument(container);
}

function getSelectedProduct(form) {
  return salesState.products.find((product) => product.id === form.elements.product_id.value);
}

function getSelectedColor(form) {
  const product = getSelectedProduct(form);
  return product?.colors.find((color) => color.id === form.elements.color_id.value);
}

function getSelectedVariation(form) {
  const color = getSelectedColor(form);
  return color?.variations.find((variation) => variation.id === form.elements.variation_id.value);
}

function updateColorOptions(container) {
  const form = container.querySelector('[data-sale-form]');
  const product = getSelectedProduct(form);
  const colorSelect = form.elements.color_id;
  const colors = (product?.colors || []).filter((color) => color.active !== false);

  colorSelect.innerHTML = colors.length
    ? colors.map((color) => `<option value="${color.id}">${escapeHtml(color.name)}</option>`).join('')
    : '<option value="">Sem cores ativas</option>';

  updateVariationOptions(container);
}

function updateVariationOptions(container) {
  const form = container.querySelector('[data-sale-form]');
  const color = getSelectedColor(form);
  const variationSelect = form.elements.variation_id;
  const variations = (color?.variations || [])
    .filter((variation) => variation.status !== 'inactive')
    .sort((a, b) => sizesOrder.indexOf(a.size) - sizesOrder.indexOf(b.size));

  variationSelect.innerHTML = variations.length
    ? variations.map((variation) => `<option value="${variation.id}">${escapeHtml(variation.size)} - ${getAvailableQuantity(variation)} disponíveis</option>`).join('')
    : '<option value="">Sem tamanhos ativos</option>';

  updateAvailableStock(container);
}

function updateAvailableStock(container) {
  const form = container.querySelector('[data-sale-form]');
  const stock = container.querySelector('[data-available-stock]');
  const variation = getSelectedVariation(form);
  stock.textContent = `Estoque disponível: ${getAvailableQuantity(variation)}`;
}

function addCartItem(container) {
  const form = container.querySelector('[data-sale-form]');
  const message = container.querySelector('[data-sale-message]');
  const product = getSelectedProduct(form);
  const color = getSelectedColor(form);
  const variation = getSelectedVariation(form);
  const quantity = Number(form.elements.quantity.value || 0);

  message.textContent = '';

  if (!product || !color || !variation) {
    message.textContent = 'Selecione produto, cor e tamanho.';
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    message.textContent = 'Informe uma quantidade válida.';
    return;
  }

  const existingQuantity = salesState.cart
    .filter((item) => item.variationId === variation.id)
    .reduce((total, item) => total + item.quantity, 0);

  if (existingQuantity + quantity > getAvailableQuantity(variation)) {
    message.textContent = 'Quantidade acima do estoque disponível.';
    return;
  }

  salesState.cart.push({
    id: crypto.randomUUID(),
    productId: product.id,
    productName: product.name,
    colorId: color.id,
    colorName: color.name,
    variationId: variation.id,
    size: variation.size,
    quantity,
    unitPrice: product.sale_price,
    subtotal: product.sale_price * quantity,
  });

  form.elements.quantity.value = '1';
  renderCart(container);
}

function removeCartItem(container, itemId) {
  salesState.cart = salesState.cart.filter((item) => item.id !== itemId);
  renderCart(container);
  showSalesToast('Item removido do carrinho.');
}

function renderCart(container) {
  const cart = container.querySelector('[data-sale-cart]');
  if (!cart) return;

  if (container.querySelector('[data-new-sale-page]')) {
    const count = salesState.cart.reduce((total, item) => total + item.quantity, 0);
    const countBadge = container.querySelector('[data-cart-count]');
    if (countBadge) countBadge.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
    cart.innerHTML = salesState.cart.length ? `<div class="pos-cart-list">${salesState.cart.map((item) => `
      <article class="pos-cart-item">
        ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="" />` : '<span class="pos-cart-item__empty">VB</span>'}
        <div><strong>${escapeHtml(item.productName)}</strong><small>${escapeHtml(item.colorName)} · ${escapeHtml(item.size)}</small><small>REF: ${escapeHtml(item.productRef || '—')}</small><div class="pos-cart-quantity"><button type="button" data-cart-quantity="${item.id}" data-delta="-1" aria-label="Diminuir quantidade">−</button><b>${item.quantity}</b><button type="button" data-cart-quantity="${item.id}" data-delta="1" aria-label="Aumentar quantidade">＋</button></div></div>
        <button class="pos-cart-remove" type="button" data-remove-sale-item="${item.id}" aria-label="Remover item">×</button>
        <b class="pos-cart-price">${currency(item.subtotal)}</b>
      </article>`).join('')}</div>` : '<div class="pos-cart-empty"><span>🛍</span><strong>Carrinho vazio</strong><p>Adicione produtos para iniciar a venda.</p></div>';
    const finalize = container.querySelector('[data-finalize-sale]');
    if (finalize) finalize.disabled = !salesState.cart.length;
    renderTotals(container);
    return;
  }

  if (!salesState.cart.length) {
    cart.innerHTML = '<p class="table-empty">Nenhum item adicionado.</p>';
    renderTotals(container);
    return;
  }

  cart.innerHTML = `
    <div class="sale-cart-list">
      ${salesState.cart.map((item) => `
        <article class="sale-cart-item">
          <div>
            <strong>${escapeHtml(item.productName)}</strong>
            <span>Cor: ${escapeHtml(item.colorName)} | Tamanho: ${escapeHtml(item.size)} | Quantidade: ${item.quantity}</span>
            <span>Valor unitário: ${currency(item.unitPrice)} | Subtotal: ${currency(item.subtotal)}</span>
          </div>
          <div>
            <strong>${currency(item.subtotal)}</strong>
          </div>
          <button class="button button--compact button--secondary" type="button" data-remove-sale-item="${item.id}">Remover</button>
        </article>
      `).join('')}
    </div>
  `;
  renderTotals(container);
}

function renderTotals(container) {
  const totals = container.querySelector('[data-sale-totals]');
  if (!totals) return;

  const values = calculateCartTotals();
  if (container.querySelector('[data-new-sale-page]')) {
    totals.innerHTML = `
      <dl class="pos-totals">
        <div><dt>Subtotal</dt><dd>${currency(values.subtotal)}</dd></div>
        <div><dt>Desconto</dt><dd>${currency(values.discount)}</dd></div>
        <div class="pos-total-highlight"><dt>TOTAL</dt><dd>${currency(values.total)}</dd></div>
      </dl>`;
    return;
  }
  totals.innerHTML = `
    <dl>
      <div><dt>Subtotal</dt><dd>${currency(values.subtotal)}</dd></div>
      <div><dt>Desconto</dt><dd>${currency(values.discount)}</dd></div>
      <div class="sale-total-final"><dt>Total</dt><dd>${currency(values.total)}</dd></div>
    </dl>
  `;
}

function getSelectedCustomerId() {
  return salesState.selectedCustomer?.id || getDefaultCustomer()?.id || null;
}

function mapPaymentMethod(value) {
  if (value === 'debit_card' || value === 'credit_card') return 'card';
  if (value === 'bank_transfer') return 'pix';
  return value;
}

function mapStoredPaymentMethod(value) {
  if (value === 'card') return 'credit_card';
  return value || 'pix';
}

function openSaleModal(container, sale = null) {
  const form = container.querySelector('[data-sale-form]');
  const title = container.querySelector('#sale-modal-title');
  const message = container.querySelector('[data-sale-message]');
  const submitButton = form.querySelector('button[type="submit"]');

  salesState.editingSale = sale;
  salesState.cart = [];
  salesState.selectedCustomer = sale
    ? salesState.customers.find((customer) => customer.id === sale.customer_id) || null
    : null;
  salesState.customerSearch = '';
  salesState.showCustomerForm = false;
  salesState.discountType = 'value';
  salesState.discountValue = 0;
  salesState.fiscalRequested = false;
  salesState.fiscalDocument = '';
  salesState.fiscalNotes = '';

  title.textContent = sale ? 'Editar Venda' : 'Nova Venda';
  form.reset();
  submitButton.disabled = false;
  submitButton.textContent = sale ? 'Salvar Alterações' : 'Finalizar Venda';
  message.textContent = '';
  container.querySelector('[data-sale-modal]').hidden = false;
  container.querySelector('[data-edit-reason-area]').hidden = !sale;
  populateSaleForm(container);
  syncFiscalFields(container);

  if (sale) {
    prepareSaleEdit(container, sale);
  }
}

function closeSaleModal(container) {
  container.querySelector('[data-sale-modal]').hidden = true;
  salesState.editingSale = null;
  salesState.cart = [];
  salesState.selectedCustomer = null;
  salesState.customerSearch = '';
  salesState.showCustomerForm = false;
}

function canEditSale(sale) {
  if (salesState.isAdmin) return true;
  const createdAt = new Date(sale.created_at).getTime();
  return Date.now() - createdAt <= 24 * 60 * 60 * 1000;
}

function prepareSaleEdit(container, sale) {
  const form = container.querySelector('[data-sale-form]');
  const message = container.querySelector('[data-sale-message]');
  if (!canEditSale(sale)) {
    message.textContent = 'Esta venda só pode ser alterada por um administrador.';
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  const parsedNotes = parseSaleNotes(sale.notes);
  salesState.discountType = 'value';
  salesState.discountValue = Number(sale.discount || 0);
  salesState.fiscalRequested = Boolean(sale.invoice_requested || parsedNotes.fiscalRequested);
  salesState.fiscalDocument = parsedNotes.fiscalDocument || salesState.selectedCustomer?.cpf || '';
  salesState.fiscalNotes = parsedNotes.fiscalNotes;
  salesState.cart = getSaleItems(sale.id).map((item) => ({
    id: crypto.randomUUID(),
    productId: item.product_id,
    productName: item.product_name,
    colorId: null,
    colorName: item.color,
    variationId: item.variation_id,
    size: item.size,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unit_price || 0),
    subtotal: Number(item.subtotal || 0),
  }));

  form.elements.payment_method.value = mapStoredPaymentMethod(sale.payment_method);
  form.elements.discount_type.value = 'value';
  form.elements.discount_value.value = String(salesState.discountValue);
  form.elements.sale_notes.value = parsedNotes.observations;
  form.elements.invoice_requested.value = salesState.fiscalRequested ? 'yes' : 'no';
  form.elements.fiscal_document.value = salesState.fiscalDocument;
  form.elements.fiscal_notes.value = salesState.fiscalNotes;

  syncFiscalFields(container);
  renderCustomerArea(container);
  renderCart(container);
  message.textContent = '';
}

function duplicateSaleToModal(container, sale = salesState.viewingSale) {
  if (!sale) return;
  openSaleModal(container, null);

  const form = container.querySelector('[data-sale-form]');
  const parsedNotes = parseSaleNotes(sale.notes);
  salesState.editingSale = null;
  salesState.selectedCustomer = salesState.customers.find((customer) => customer.id === sale.customer_id) || null;
  salesState.discountType = 'value';
  salesState.discountValue = Number(sale.discount || 0);
  salesState.fiscalRequested = Boolean(sale.invoice_requested || parsedNotes.fiscalRequested);
  salesState.fiscalDocument = parsedNotes.fiscalDocument || salesState.selectedCustomer?.cpf || '';
  salesState.fiscalNotes = parsedNotes.fiscalNotes;
  salesState.cart = getSaleItems(sale.id).map((item) => ({
    id: crypto.randomUUID(),
    productId: item.product_id,
    productName: item.product_name,
    colorId: null,
    colorName: item.color,
    variationId: item.variation_id,
    size: item.size,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unit_price || 0),
    subtotal: Number(item.subtotal || 0),
  }));

  container.querySelector('#sale-modal-title').textContent = `Duplicar ${formatSaleOperationNumber(sale)}`;
  form.querySelector('button[type="submit"]').textContent = 'Criar venda duplicada';
  form.elements.payment_method.value = mapStoredPaymentMethod(sale.payment_method);
  form.elements.discount_type.value = 'value';
  form.elements.discount_value.value = String(salesState.discountValue);
  form.elements.sale_notes.value = parsedNotes.observations;
  form.elements.invoice_requested.value = salesState.fiscalRequested ? 'yes' : 'no';
  form.elements.fiscal_document.value = salesState.fiscalDocument;
  form.elements.fiscal_notes.value = salesState.fiscalNotes;
  container.querySelector('[data-edit-reason-area]').hidden = true;

  syncFiscalFields(container);
  renderCustomerArea(container);
  renderCart(container);
  closeSaleDetails(container);
}

async function submitSale(container, event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = container.querySelector('[data-sale-message]');

  if (!salesState.cart.length) {
    message.textContent = 'Adicione pelo menos um item à venda.';
    return;
  }

  const totals = calculateCartTotals();
  const customerId = getSelectedCustomerId();
  const notes = buildSaleNotes(form);

  if (!customerId) {
    message.textContent = 'Cliente Diversos não foi encontrado. Selecione ou cadastre um cliente.';
    return;
  }

  if (salesState.editingSale) {
    const reason = form.elements.edit_reason.value.trim();
    if (!salesState.isAdmin && !reason) {
      message.textContent = 'Informe o motivo da alteração.';
      return;
    }

    message.textContent = 'Salvando alteração...';

    const { error } = await supabase.rpc('edit_sale_with_items', {
      p_sale_id: salesState.editingSale.id,
      p_customer_id: customerId,
      p_channel: salesState.editingSale.channel || 'physical_store',
      p_payment_method: mapPaymentMethod(form.elements.payment_method.value),
      p_discount: totals.discount,
      p_notes: notes,
      p_items: salesState.cart.map((item) => ({
        variation_id: item.variationId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      p_reason: reason || null,
    });

    if (error) {
      console.error('Erro ao editar venda:', error);
      message.textContent = error.message === 'Esta venda so pode ser alterada por um administrador.'
        ? 'Esta venda só pode ser alterada por um administrador.'
        : `Erro ao editar venda: ${error.message}`;
      showSalesToast('Erro ao finalizar venda.', 'danger');
      return;
    }

    closeSaleModal(container);
    await loadSalesData(container);
    showSalesToast('Venda editada com sucesso.');
    return;
  }

  message.textContent = 'Finalizando venda...';

  const { error } = await supabase.rpc('create_sale_with_items', {
    p_customer_id: customerId,
    p_channel: 'physical_store',
    p_payment_method: mapPaymentMethod(form.elements.payment_method.value),
    p_items: salesState.cart.map((item) => ({
      product_id: item.productId,
      variation_id: item.variationId,
      quantity: item.quantity,
    })),
    p_discount: totals.discount,
    p_notes: notes,
    p_invoice_requested: form.elements.invoice_requested.value === 'yes',
  });

  if (error) {
    console.error('Erro ao finalizar venda:', error);
    message.textContent = `Erro ao finalizar venda: ${error.message}`;
    showSalesToast('Erro ao finalizar venda.', 'danger');
    return;
  }

  if (container.querySelector('[data-new-sale-page]')) {
    window.location.hash = '#/vendas';
  } else {
    closeSaleModal(container);
    await loadSalesData(container);
  }
  showSalesToast('Venda criada com sucesso.');
}

function renderReceiptModalContent(container, sale) {
  const receipt = container.querySelector('[data-sale-receipt]');
  if (!receipt || !sale) return;
  receipt.innerHTML = renderThermalReceipt(getReceiptData(sale));
}

function openSaleReceipt(container, sale = salesState.viewingSale) {
  if (!sale) return;
  salesState.receiptSale = sale;
  renderReceiptModalContent(container, sale);
  const message = container.querySelector('[data-sale-receipt-message]');
  if (message) message.textContent = '';
  const detailsModal = container.querySelector('[data-sale-details-modal]');
  if (detailsModal) detailsModal.hidden = true;
  container.querySelector('[data-sale-receipt-modal]').hidden = false;
}

function closeSaleReceipt(container) {
  container.querySelector('[data-sale-receipt-modal]').hidden = true;
  salesState.receiptSale = null;
}

function backToSaleDetails(container) {
  container.querySelector('[data-sale-receipt-modal]').hidden = true;
  if (salesState.viewingSale) {
    container.querySelector('[data-sale-details-modal]').hidden = false;
  } else {
    salesState.receiptSale = null;
  }
}

async function downloadSaleReceiptPdf(container, button) {
  const sale = salesState.receiptSale || salesState.viewingSale;
  const receipt = container.querySelector('[data-sale-receipt] [data-thermal-receipt]');
  const message = container.querySelector('[data-sale-receipt-message]');
  if (!sale || !receipt) return;

  if (typeof window.html2pdf !== 'function') {
    if (message) message.textContent = 'Não foi possível carregar o gerador de PDF.';
    return;
  }

  const originalLabel = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.textContent = 'Gerando PDF…';
  }
  if (message) message.textContent = '';

  try {
    await Promise.all(Array.from(receipt.querySelectorAll('img')).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
    if (document.fonts?.ready) await document.fonts.ready;

    receipt.classList.add('thermal-receipt--pdf');
    const heightMm = Math.max(20, Math.ceil((receipt.scrollHeight * 25.4) / 96) + 1);
    await window.html2pdf().set({
      margin: 0,
      filename: thermalReceiptFilename(formatSaleOperationNumber(sale)),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        backgroundColor: '#fffdf8',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: {
        unit: 'mm',
        format: [80, heightMm],
        orientation: 'portrait',
        compress: true,
      },
      pagebreak: { mode: [] },
    }).from(receipt).save();
  } catch (error) {
    console.error('Falha ao gerar recibo em PDF:', error);
    if (message) message.textContent = 'Não foi possível gerar o PDF. Tente novamente.';
  } finally {
    receipt.classList.remove('thermal-receipt--pdf');
    if (button) {
      button.disabled = false;
      button.innerHTML = originalLabel;
    }
  }
}

async function printSaleReceipt(container) {
  const sale = salesState.receiptSale || salesState.viewingSale;
  const receipt = container.querySelector('[data-sale-receipt] [data-thermal-receipt]');
  const message = container.querySelector('[data-sale-receipt-message]');
  if (!sale || !receipt) return;

  const printWindow = window.open('', '_blank', 'width=360,height=640');
  if (!printWindow) {
    if (message) message.textContent = 'Permita pop-ups para abrir a impressão do recibo.';
    return;
  }

  try {
    const stylesheetUrl = new URL('assets/css/thermal-receipt.css', document.baseURI).href;
    const baseUrl = new URL('.', document.baseURI).href;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <base href="${baseUrl}">
          <title>Recibo ${escapeHtml(formatSaleOperationNumber(sale))}</title>
          <link rel="stylesheet" href="${stylesheetUrl}">
          <style>
            @page { size: 72mm auto; margin: 0; }
            html, body {
              width: 72mm !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              background: #fff !important;
            }
            body { display: block !important; }
            .thermal-print-document {
              display: block !important;
              width: 72mm !important;
              max-width: 72mm !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 0 0 4mm !important;
              overflow: visible !important;
            }
            .thermal-print-document .thermal-receipt {
              display: grid !important;
              width: 72mm !important;
              max-width: 72mm !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 4mm !important;
              overflow: visible !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              transform: none !important;
              background: #fff !important;
            }
            .thermal-print-document .thermal-receipt > :last-child { margin-bottom: 0 !important; }
            .thermal-receipt__item { break-inside: avoid; page-break-inside: avoid; }
            @media print {
              html, body, .thermal-print-document, .thermal-receipt {
                height: auto !important;
                min-height: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <main class="thermal-print-document">${receipt.outerHTML}</main>
        </body>
      </html>`);
    printWindow.document.close();

    await new Promise((resolve) => {
      if (printWindow.document.readyState === 'complete') resolve();
      else printWindow.addEventListener('load', resolve, { once: true });
    });
    await Promise.all(Array.from(printWindow.document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
    if (printWindow.document.fonts?.ready) await printWindow.document.fonts.ready;

    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
    printWindow.focus();
    printWindow.print();
    if (message) message.textContent = '';
  } catch (error) {
    console.error('Falha ao preparar impressão térmica:', error);
    printWindow.close();
    if (message) message.textContent = 'Não foi possível preparar a impressão. Tente novamente.';
  }
}

function buildWhatsAppUrl(phone, message) {
  const digits = normalizeDigits(phone);
  if (!digits) return null;
  const normalizedPhone = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function getSaleWhatsappMessage(sale) {
  const customer = getSaleCustomer(sale);
  return [
    `Olá, ${sale.customer_name || customer?.name || 'cliente'}.`,
    '',
    `Segue o resumo da sua compra na ${storeConfig.store_name}.`,
    '',
    `Venda: ${formatSaleOperationNumber(sale)}`,
    '',
    `Total: ${currency(sale.net_total)}`,
    '',
    `Pagamento: ${paymentLabels[sale.payment_method] || sale.payment_method || '-'}`,
    '',
    'Obrigado pela preferência.',
  ].join('\n');
}

function renderSaleWhatsappConfirm(container, sale) {
  const target = container.querySelector('[data-sale-whatsapp-confirm]');
  if (!target || !sale) return;
  const customer = getSaleCustomer(sale);
  const hasWhatsapp = Boolean(normalizeDigits(customer?.whatsapp));
  target.innerHTML = `
    <div class="sale-whatsapp-icon" aria-hidden="true">${saleDrawerIcon('whatsapp')}</div>
    <p>Confirme os dados para envio do recibo.</p>
    <article class="sale-whatsapp-customer">
      <div>
        <span>Cliente</span>
        <strong>${escapeHtml(sale.customer_name || customer?.name || '-')}</strong>
      </div>
      <div>
        <span>Número do WhatsApp</span>
        <strong>${escapeHtml(customer?.whatsapp || '-')}</strong>
        ${saleDrawerIcon('whatsapp')}
      </div>
    </article>
    <div class="sale-whatsapp-note">${saleDrawerIcon('package')}<span>${hasWhatsapp ? `O recibo térmico ${escapeHtml(thermalReceiptFilename(formatSaleOperationNumber(sale)))} será enviado em PDF.` : 'Este cliente não possui WhatsApp cadastrado.'}</span></div>
    <div class="modal__actions sale-whatsapp-actions">
      <button class="button button--secondary" type="button" data-close-sale-whatsapp-modal>Cancelar</button>
      <button class="button button--primary sale-view-action--whatsapp" type="button" data-confirm-sale-whatsapp ${hasWhatsapp ? '' : 'disabled'}>${saleDrawerIcon('send')} Enviar recibo</button>
    </div>
    <p class="form-message" data-sale-whatsapp-message></p>
  `;
}

function openSaleWhatsappModal(container, sale = salesState.receiptSale || salesState.viewingSale) {
  if (!sale) return;
  salesState.receiptSale = sale;
  renderSaleWhatsappConfirm(container, sale);
  container.querySelector('[data-sale-whatsapp-modal]').hidden = false;
}

function closeSaleWhatsappModal(container) {
  container.querySelector('[data-sale-whatsapp-modal]').hidden = true;
}

function openSaleWhatsappSuccessModal(container, sale) {
  const target = container.querySelector('[data-sale-whatsapp-success]');
  if (!target || !sale) return;
  const customer = getSaleCustomer(sale);
  target.innerHTML = `
    <div class="sale-whatsapp-success__icon" aria-hidden="true">${saleDrawerIcon('check')}</div>
    <h3>Recibo enviado com sucesso!</h3>
    <p>O recibo foi enviado para<br><strong>${escapeHtml(customer?.whatsapp || '-')}</strong></p>
    <button class="button button--secondary" type="button" data-close-sale-whatsapp-success-modal>Fechar</button>
  `;
  container.querySelector('[data-sale-whatsapp-success-modal]').hidden = false;
}

function closeSaleWhatsappSuccessModal(container) {
  container.querySelector('[data-sale-whatsapp-success-modal]').hidden = true;
}

function sendSaleWhatsApp(container) {
  const sale = salesState.receiptSale || salesState.viewingSale;
  if (!sale) return false;

  const customer = getSaleCustomer(sale);
  const messageElement = container.querySelector('[data-sale-whatsapp-message]') || container.querySelector('[data-sale-receipt-message]');
  const url = buildWhatsAppUrl(customer?.whatsapp, getSaleWhatsappMessage(sale));

  if (!url) {
    if (messageElement) messageElement.textContent = 'Este cliente não possui WhatsApp cadastrado.';
    return false;
  }

  if (messageElement) messageElement.textContent = '';
  window.open(url, '_blank', 'noopener,noreferrer');
  closeSaleWhatsappModal(container);
  openSaleWhatsappSuccessModal(container, sale);
  return true;
}

function openCancelSaleModal(container, sale = salesState.viewingSale) {
  const message = container.querySelector('[data-cancel-sale-message]');
  const form = container.querySelector('[data-cancel-sale-form]');

  if (!salesState.isAdmin) {
    if (message) message.textContent = 'Somente administradores podem cancelar vendas.';
    return;
  }

  if (!sale || sale.status === 'cancelled') return;
  salesState.cancellingSale = sale;
  form.reset();
  message.textContent = '';
  container.querySelector('[data-cancel-sale-modal]').hidden = false;
}

function closeCancelSaleModal(container) {
  container.querySelector('[data-cancel-sale-modal]').hidden = true;
  salesState.cancellingSale = null;
}

async function submitCancelSale(container, event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = container.querySelector('[data-cancel-sale-message]');
  const reason = form.elements.cancel_reason.value.trim();

  if (!salesState.isAdmin) {
    message.textContent = 'Somente administradores podem cancelar vendas.';
    return;
  }

  if (!reason) {
    message.textContent = 'Informe o motivo do cancelamento.';
    return;
  }

  if (!salesState.cancellingSale) return;
  message.textContent = 'Cancelando venda...';

  const { error } = await supabase.rpc('cancel_sale', {
    p_sale_id: salesState.cancellingSale.id,
  });

  if (error) {
    console.error('Erro ao cancelar venda:', error);
    message.textContent = error.message === 'Only admin can cancel sales'
      ? 'Somente administradores podem cancelar vendas.'
      : `Erro ao cancelar venda: ${error.message}`;
    showSalesToast('Erro ao cancelar venda.', 'danger');
    return;
  }

  closeCancelSaleModal(container);
  closeSaleDetails(container);
  await loadSalesData(container);
  showSalesToast('Venda cancelada com sucesso.');
}

async function loadSaleHistory(container, saleId) {
  const history = container.querySelector('[data-sale-history]');
  if (!history) return;

  const { data, error } = await supabase
    .from('audit_logs')
    .select('user_id, user_role, action, after_data, created_at')
    .eq('entity_type', 'sale')
    .eq('entity_id', saleId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error || !data?.length) {
    history.innerHTML = '<p class="table-empty">Histórico será exibido após integração completa da auditoria.</p>';
    return;
  }

  history.innerHTML = `
    <div class="sale-history-list">
      ${data.map((item) => {
        const reason = item.after_data?.edit_context?.reason || '-';
        return `
          <article class="sale-history-item">
            <strong>${escapeHtml(item.action || '-')}</strong>
            <span>${escapeHtml(formatDate(item.created_at))}</span>
            <span>Usuário: ${escapeHtml(item.user_role || item.user_id || '-')}</span>
            <span>Motivo: ${escapeHtml(reason)}</span>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function openSaleDetails(container, saleId) {
  const sale = salesState.sales.find((item) => item.id === saleId);
  if (!sale) return;
  salesState.viewingSale = sale;

  const items = getSaleItems(sale.id);
  const customer = getSaleCustomer(sale);
  const fiscal = parseSaleNotes(sale.notes);
  const invoiceRequested = isInvoiceRequested(sale);
  const totalPieces = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const totalProducts = items.length;
  const paymentLabel = paymentLabels[sale.payment_method] || sale.payment_method || '-';
  const saleStatus = statusLabels[sale.status] || sale.status || '-';
  const receivedAmount = Number(sale.received_amount ?? sale.paid_amount ?? sale.net_total ?? 0);
  const changeAmount = Math.max(0, receivedAmount - Number(sale.net_total || 0));
  const originLabel = sale.channel === 'online' ? 'Venda online' : 'Venda presencial';
  const details = container.querySelector('[data-sale-details]');
  details.innerHTML = `
    <header class="sale-view-header">
      <div class="sale-view-header__title">
        <h3 id="sale-details-title">Detalhes da venda</h3>
        <span class="sale-view-status" data-status="${escapeHtml(sale.status || 'completed')}">✓ ${escapeHtml(saleStatus)}</span>
      </div>
      <button class="sale-view-close" type="button" data-close-sale-details-modal aria-label="Fechar">×</button>
    </header>

    <section class="sale-view-top">
      <span class="sale-view-icon" aria-hidden="true">${saleDrawerIcon('package')}</span>
      <div>
        <strong>${escapeHtml(formatSaleOperationNumber(sale))}</strong>
        <span>${escapeHtml(formatDate(sale.created_at))}</span>
      </div>
      <div class="sale-view-top__actions">
        <div class="sale-view-more">
          <button class="button button--secondary sale-view-chip-button" type="button" data-sale-more-toggle>${saleDrawerIcon('more')} Mais opções</button>
          <div class="sale-view-more__menu" data-sale-more-menu hidden>
            <button type="button" data-duplicate-sale>${saleDrawerIcon('file')} Duplicar venda</button>
            ${salesState.isAdmin && sale.status !== 'cancelled' ? `<button type="button" data-open-cancel-sale>${saleDrawerIcon('trash')} Cancelar venda</button>` : ''}
          </div>
        </div>
      </div>
    </section>

    <section class="sale-view-section">
      <h4>${saleDrawerIcon('user')} Cliente</h4>
      <article class="sale-view-client-card">
        <span class="sale-view-client-icon" aria-hidden="true">${saleDrawerIcon('user')}</span>
        <div>
          <strong>${escapeHtml(sale.customer_name || customer?.name || '-')}</strong>
          <span>${escapeHtml(customer?.whatsapp || customer?.cpf || 'Sem contato')}</span>
        </div>
        ${customer?.whatsapp ? `<button class="sale-view-whatsapp" type="button" data-open-sale-whatsapp aria-label="Enviar WhatsApp para cliente">${saleDrawerIcon('whatsapp')}</button>` : ''}
      </article>
    </section>

    <section class="sale-view-section">
      <h4>${saleDrawerIcon('cart')} Itens da venda (${totalProducts})</h4>
      ${items.length ? `
        <div class="sale-view-items">
          ${items.map((item) => {
            const product = salesState.products.find((productItem) => productItem.id === item.product_id);
            const color = product?.colors?.find((colorItem) => normalize(colorItem.name) === normalize(item.color)) || null;
            const imageUrl = getProductImage(product, color);
            const unitPrice = Number(item.unit_price ?? item.unitPrice ?? (Number(item.subtotal || 0) / Math.max(1, Number(item.quantity || 1))));
            return `
            <article class="sale-view-item">
              ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" />` : '<span class="sale-view-item__empty">VB</span>'}
              <div class="sale-view-item__name">
                <strong>${escapeHtml(item.product_name)}</strong>
                <span>${escapeHtml(item.color)} · ${escapeHtml(item.size)}</span>
              </div>
              <div><span>Preço unit.</span><strong>${currency(unitPrice)}</strong></div>
              <div><span>Qtd</span><strong>${item.quantity}</strong></div>
              <div><span>Total</span><strong>${currency(item.subtotal)}</strong></div>
            </article>`;
          }).join('')}
        </div>
      ` : '<p class="sale-view-empty">Itens não disponíveis para este perfil ou policy atual.</p>'}
    </section>

    <section class="sale-view-section">
      <h4>${saleDrawerIcon('card')} Resumo financeiro</h4>
      <div class="sale-view-values-grid">
        <article class="sale-view-financial-card">
          <div><span>Subtotal</span><strong>${currency(sale.gross_total)}</strong></div>
          <div><span>Desconto</span><strong>${currency(sale.discount)}</strong></div>
          <div class="sale-view-total"><span>Total</span><strong>${currency(sale.net_total)}</strong></div>
        </article>
        <article class="sale-view-paid-card">
          <span class="sale-view-paid-card__icon" aria-hidden="true">${saleDrawerIcon('wallet')}</span>
          <div>
            <span>Valor total pago</span>
            <strong>${currency(sale.net_total)}</strong>
          </div>
        </article>
      </div>
      <article class="sale-view-fiscal-cards">
        <div>${saleDrawerIcon('card')}<span>Pagamento</span><strong>${escapeHtml(paymentLabel)}</strong></div>
        <div>${saleDrawerIcon('file')}<span>NF solicitada</span><strong>${invoiceRequested ? 'Sim' : 'Não'}</strong></div>
        <div>${saleDrawerIcon('badge')}<span>CPF/CNPJ utilizado</span><strong>${escapeHtml(fiscal.fiscalDocument || '-')}</strong></div>
        <div>${saleDrawerIcon('info')}<span>Observações fiscais</span><strong>${escapeHtml(fiscal.fiscalNotes || '-')}</strong></div>
      </article>
    </section>

    <section class="sale-view-section">
      <h4>${saleDrawerIcon('info')} Informações adicionais</h4>
      <article class="sale-view-info-card">
        <div><span>Vendedor</span><strong>${escapeHtml(sale.seller_name || sale.created_by || 'Administrador')}</strong></div>
        <div><span>Origem</span><strong>${escapeHtml(originLabel)}</strong></div>
        <div><span>Peças</span><strong>${totalPieces}</strong></div>
        <div><span>Nota Fiscal</span><strong>${invoiceRequested ? 'Solicitada' : 'Não solicitada'}</strong></div>
        ${invoiceRequested ? `<div><span>CPF/CNPJ NF</span><strong>${escapeHtml(fiscal.fiscalDocument || '-')}</strong></div>` : ''}
        <div><span>Observação</span><strong>${escapeHtml(fiscal.observations || fiscal.fiscalNotes || '-')}</strong></div>
      </article>
    </section>
  `;
  const cancelButton = container.querySelector('[data-open-cancel-sale]');
  if (cancelButton) {
    cancelButton.hidden = !salesState.isAdmin || sale.status === 'cancelled';
  }
  const footer = container.querySelector('[data-sale-details-modal] .sale-drawer__footer');
  if (footer) {
    footer.innerHTML = `
      <button class="button button--secondary sale-view-action sale-view-action--edit" type="button" data-edit-sale-drawer>${saleDrawerIcon('edit')} Editar venda</button>
      <button class="button button--secondary sale-view-action sale-view-action--receipt" type="button" data-open-sale-receipt>${saleDrawerIcon('info')} Ver recibo</button>
    `;
  }
  container.querySelector('[data-sale-details-modal]').hidden = false;
  loadSaleHistory(container, sale.id);
}

function closeSaleDetails(container) {
  container.querySelector('[data-sale-details-modal]').hidden = true;
  salesState.viewingSale = null;
}

function getProductStock(product) {
  return (product?.colors || []).reduce((total, color) => total + color.variations.reduce((sum, variation) => sum + getAvailableQuantity(variation), 0), 0);
}

function getProductVariationsCount(product) {
  return (product?.colors || []).reduce((total, color) => total + color.variations.length, 0);
}

function getProductReference(product) {
  return String(product?.sku || product?.name || '').replace(/^(?:ref\.?\s*:?\s*)+/i, '').trim() || '—';
}

function getProductImage(product, color = null) {
  return color?.imageUrl || product?.image_url || product?.colors?.find((item) => item.imageUrl)?.imageUrl || '';
}

function productImageMarkup(product, color = null, className = 'pos-product-thumb') {
  const image = getProductImage(product, color);
  if (image) return `<img class="${className}" src="${escapeHtml(image)}" alt="" loading="lazy" />`;
  return `<span class="${className} ${className}--empty" aria-hidden="true">VB</span>`;
}

function colorSwatch(name) {
  const colors = {
    preto: '#111827', bege: '#e7dcc8', 'azul bb': '#7ca8d8', azul: '#4578b4',
    grafite: '#4b5563', 'off white': '#f2f0ea', branco: '#ffffff', marrom: '#795234',
    vermelho: '#b91c1c', verde: '#3f775a', rosa: '#d78ba0', amarelo: '#d9ae3b',
  };
  return colors[normalize(name)] || '#9ca3af';
}

function getExpandedProduct() {
  return salesState.products.find((product) => product.id === salesState.expandedProductId) || null;
}

function getPosColor() {
  return getExpandedProduct()?.colors.find((color) => color.id === salesState.selectedColorId) || null;
}

function getPosVariation() {
  return getPosColor()?.variations.find((variation) => variation.id === salesState.selectedVariationId) || null;
}

function selectInitialVariation(product) {
  const color = product?.colors.find((item) => item.active !== false && item.variations.some((variation) => getAvailableQuantity(variation) > 0))
    || product?.colors.find((item) => item.active !== false)
    || null;
  const variation = color?.variations
    .filter((item) => item.status !== 'inactive')
    .sort((a, b) => sizesOrder.indexOf(a.size) - sizesOrder.indexOf(b.size))
    .find((item) => getAvailableQuantity(item) > 0) || null;
  salesState.selectedColorId = color?.id || null;
  salesState.selectedVariationId = variation?.id || null;
  salesState.itemQuantity = 1;
}

function getFilteredProducts() {
  const search = normalize(salesState.productSearch);
  if (!search) return salesState.products;
  return salesState.products.filter((product) => {
    const details = [product.name, product.description, product.sku];
    product.colors.forEach((color) => {
      details.push(color.name);
      color.variations.forEach((variation) => details.push(variation.size, variation.id));
    });
    return normalize(details.join(' ')).includes(search);
  });
}

function renderNewSaleLayout(container) {
  const editing = Boolean(salesState.editingSale);
  container.innerHTML = `
    <form class="pos-page" data-sale-form data-new-sale-page>
      <main class="pos-workspace">
        <header class="pos-header">
          <div>
            <a class="pos-back" href="#/vendas">← &nbsp;Voltar</a>
            <p class="eyebrow" data-new-sale-mode>${editing ? 'Editando venda' : 'Nova venda'}</p>
            <h1 data-new-sale-title>${editing ? `Editar Venda ${formatSaleOperationNumber(salesState.editingSale)}` : 'Nova Venda'}</h1>
            <p>Selecione o cliente e adicione os produtos à venda.</p>
          </div>
          <div class="pos-header__actions">
            <button class="ds-button ds-button--secondary ds-button--small" type="button" data-focus-product-search>⌨ &nbsp; Atalhos <span>(F1)</span></button>
            <button class="ds-button ds-button--secondary ds-button--small" type="button" data-toggle-fiscal-panel>⚡ &nbsp; Ações rápidas</button>
          </div>
        </header>

        <section class="pos-customer-card" aria-labelledby="pos-customer-title">
          <div class="pos-customer-card__search">
            <div class="pos-section-label"><strong id="pos-customer-title">Cliente</strong><button class="ds-button ds-button--outline-gold ds-button--small" type="button" data-toggle-sale-customer-form>＋ Novo Cliente</button></div>
            <div data-sale-customer-area></div>
          </div>
        </section>

        <section class="pos-products-card">
          <div class="pos-product-toolbar">
            <label class="ds-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar produto por nome, referência ou código de barras..." autocomplete="off" data-pos-product-search /></label>
            <button class="ds-button ds-button--secondary" type="button">Todas as categorias⌄</button>
            <button class="ds-button ds-button--secondary" type="button">▽ &nbsp; Filtros</button>
          </div>
          <div class="pos-product-list" data-pos-product-list>
            ${Array.from({ length: 5 }, () => '<div class="pos-product-skeleton ds-skeleton"></div>').join('')}
          </div>
        </section>

        <nav class="pos-shortcuts" aria-label="Atalhos de teclado">
          <span><kbd>F2</kbd><b>Buscar produto</b></span>
          <span><kbd>F3</kbd><b>Novo cliente</b></span>
          <span><kbd>%</kbd><b>Desconto rápido</b></span>
          <span><kbd>＋ / −</kbd><b>Quantidade</b></span>
          <span><kbd>F10</kbd><b>Finalizar venda</b></span>
          <span><kbd>Esc</kbd><b>Cancelar venda</b></span>
        </nav>
      </main>

      <aside class="pos-cart-panel">
        <section class="pos-cart-card">
          <div class="pos-cart-title"><h2>Carrinho <span data-cart-count>0 itens</span></h2><button class="ds-icon-button" type="button" data-clear-cart aria-label="Limpar carrinho">♲</button></div>
          <div class="pos-cart-body" data-sale-cart></div>
        </section>

        <section class="pos-summary-card">
          <div class="pos-summary-head">
            <h2>Resumo da venda</h2>
            <div data-sale-totals></div>
          </div>
          <div class="pos-summary-fields">
            <label><span>Pagamento</span><select name="payment_method" required><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="debit_card">Cartão Débito</option><option value="credit_card">Cartão Crédito</option><option value="bank_transfer">Transferência</option></select></label>
            <input type="hidden" name="discount_type" value="value" />
            <label><span>Desconto</span><div class="pos-money-input"><b>R$</b><input name="discount_value" type="number" min="0" step="0.01" value="0" /></div></label>
            <label class="pos-summary-fields__notes"><span>Observações</span><textarea name="sale_notes" rows="2" placeholder="Ex.: atendimento, retirada, entrega..."></textarea></label>
          </div>
          <section class="pos-fiscal-panel" data-sale-fiscal-panel hidden>
            <label class="pos-checkbox"><input type="checkbox" data-invoice-requested /> Cliente solicitou NF?</label>
            <input type="hidden" name="invoice_requested" value="no" />
            <div class="sale-fiscal-fields" data-sale-fiscal-fields hidden>
              <label><span>CPF/CNPJ para NF</span><input name="fiscal_document" type="text" /></label>
              <label><span>Observações fiscais</span><textarea name="fiscal_notes" rows="2"></textarea></label>
            </div>
          </section>
          <section class="pos-edit-panel" data-edit-reason-area hidden>
            <h3>Motivo da alteração</h3>
            <label>
              <span>Explique o ajuste para manter o histórico da venda.</span>
              <textarea name="edit_reason" rows="3" placeholder="Obrigatório para vendedores ao editar"></textarea>
            </label>
          </section>
          <p class="form-message pos-sale-message" data-sale-message></p>
          <div class="pos-summary-actions">
            <a class="ds-button ds-button--secondary" href="#/vendas">Cancelar venda</a>
            <button class="ds-button ds-button--gold" type="submit" data-finalize-sale disabled>${editing ? 'Salvar alterações' : 'Finalizar venda'} &nbsp; ✓</button>
          </div>
        </section>
      </aside>
    </form>
  `;
}

function renderPosCustomerArea(container) {
  const area = container.querySelector('[data-sale-customer-area]');
  if (!area) return;
  if (salesState.showCustomerForm) {
    area.innerHTML = renderInlineCustomerForm();
    return;
  }
  const selected = salesState.selectedCustomer || getDefaultCustomer();
  const suggestions = getCustomerSuggestions();
  area.innerHTML = `
    <div class="pos-customer-row">
      <div class="pos-customer-search-wrap">
        <label class="ds-search"><span aria-hidden="true">⌕</span><input name="customer_search" type="search" value="${escapeHtml(salesState.customerSearch)}" placeholder="Buscar por nome, CPF ou WhatsApp..." autocomplete="off" data-sale-customer-search /></label>
        ${suggestions.length ? `<div class="pos-customer-suggestions">${suggestions.map((customer) => `<button type="button" data-select-sale-customer="${customer.id}"><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.whatsapp || customer.cpf || 'Sem contato')}</small></button>`).join('')}</div>` : ''}
      </div>
      <article class="pos-selected-customer">
        <span class="pos-customer-avatar">${escapeHtml((selected?.name || 'Cliente Diversos').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase())}</span>
        <div><strong>${escapeHtml(selected?.name || 'Cliente Diversos')}</strong>${selected?.is_default ? '<em>Padrão</em>' : ''}<small>CPF: ${escapeHtml(selected?.cpf || '---')}</small><small>WhatsApp: ${escapeHtml(selected?.whatsapp || '---')}</small></div>
        ${salesState.selectedCustomer && !salesState.selectedCustomer.is_default ? '<button type="button" data-clear-sale-customer aria-label="Usar Cliente Diversos">×</button>' : ''}
      </article>
    </div>`;
}

function renderPosProductList(container) {
  const list = container.querySelector('[data-pos-product-list]');
  if (!list) return;
  const products = getFilteredProducts();
  if (!products.length) {
    list.innerHTML = '<div class="ds-empty"><strong>Nenhum produto encontrado</strong><span>Tente buscar por outro nome, referência, cor ou tamanho.</span></div>';
    return;
  }
  list.innerHTML = products.map((product) => {
    const expanded = product.id === salesState.expandedProductId;
    const stock = getProductStock(product);
    const variations = getProductVariationsCount(product);
    return `
      <article class="pos-product ${expanded ? 'is-expanded' : ''}">
        <button class="pos-product-row" type="button" data-toggle-product="${product.id}" aria-expanded="${expanded}">
          ${productImageMarkup(product)}
          <span class="pos-product-name"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description || 'Produto Veste Bem')}</small></span>
          <span><small>REF.</small><b>${escapeHtml(getProductReference(product))}</b></span>
          <span><small>Variações</small><b>${variations}</b></span>
          <span><small>Estoque</small><b>${stock} peças</b></span>
          <i>${expanded ? '⌃' : '⌄'}</i>
        </button>
        ${expanded ? renderPosProductExpanded(product) : ''}
      </article>`;
  }).join('');
}

function renderPosProductExpanded(product) {
  const color = getPosColor();
  const variation = getPosVariation();
  const colors = product.colors.filter((item) => item.active !== false);
  const variations = (color?.variations || []).filter((item) => item.status !== 'inactive').sort((a, b) => sizesOrder.indexOf(a.size) - sizesOrder.indexOf(b.size));
  const available = getAvailableQuantity(variation);
  const code = `${getProductReference(product)}-${String(color?.name || '').toUpperCase().replace(/\s+/g, '-')}-${variation?.size || ''}`;
  return `<div class="pos-product-expanded">
    <section><h3>1. Escolha a cor</h3><div class="pos-color-list">${colors.map((item) => {
      const stock = item.variations.reduce((sum, current) => sum + getAvailableQuantity(current), 0);
      return `<button type="button" data-select-color="${item.id}" class="${item.id === salesState.selectedColorId ? 'is-selected' : ''}" ${stock <= 0 ? 'disabled' : ''}><i style="--swatch:${colorSwatch(item.name)}"></i><span>${escapeHtml(item.name)}</span><b>${stock}</b></button>`;
    }).join('')}</div></section>
    <section><h3>2. Escolha o tamanho</h3><div class="pos-size-list">${variations.map((item) => `<button type="button" data-select-variation="${item.id}" class="${item.id === salesState.selectedVariationId ? 'is-selected' : ''}" ${getAvailableQuantity(item) <= 0 ? 'disabled' : ''}>${escapeHtml(item.size)}</button>`).join('')}</div><p class="pos-stock ${available ? '' : 'is-empty'}">● ${available ? `Disponível: ${available} peças` : 'Sem estoque disponível'}</p><div class="pos-sku-box"><b>Código: ${escapeHtml(code)}</b><strong>Preço: ${currency(product.sale_price)}</strong></div></section>
    <section><h3>3. Quantidade</h3><div class="pos-quantity"><button type="button" data-pos-quantity="-1">−</button><input type="number" min="1" max="${available}" value="${salesState.itemQuantity}" data-pos-quantity-input /><button type="button" data-pos-quantity="1">＋</button></div><button class="ds-button ds-button--gold pos-add-button" type="button" data-add-pos-item ${!variation || available <= 0 ? 'disabled' : ''}>🛒 &nbsp; Adicionar ao carrinho</button><button class="ds-button ds-button--outline-gold" type="button" data-add-other-variation>＋ &nbsp; Adicionar outra variação</button><small class="pos-helper">ⓘ &nbsp; Adicione o mesmo modelo em outra cor ou tamanho rapidamente.</small></section>
  </div>`;
}

function addPosCartItem(container) {
  const product = getExpandedProduct();
  const color = getPosColor();
  const variation = getPosVariation();
  const quantity = Number(salesState.itemQuantity || 0);
  const message = container.querySelector('[data-sale-message]');
  if (message) message.textContent = '';
  if (!product || !color || !variation || !Number.isInteger(quantity) || quantity < 1) {
    if (message) message.textContent = 'Selecione cor, tamanho e uma quantidade válida.';
    return;
  }
  const existing = salesState.cart.find((item) => item.variationId === variation.id);
  const currentQuantity = existing?.quantity || 0;
  if (currentQuantity + quantity > getAvailableQuantity(variation)) {
    if (message) message.textContent = 'Quantidade acima do estoque disponível.';
    return;
  }
  if (existing) {
    existing.quantity += quantity;
    existing.subtotal = existing.quantity * existing.unitPrice;
  } else {
    salesState.cart.push({ id: crypto.randomUUID(), productId: product.id, productName: product.name, productRef: getProductReference(product), imageUrl: getProductImage(product, color), colorId: color.id, colorName: color.name, variationId: variation.id, size: variation.size, quantity, unitPrice: product.sale_price, subtotal: product.sale_price * quantity });
  }
  salesState.itemQuantity = 1;
  renderCart(container);
  renderPosProductList(container);
  if (message) message.textContent = `${product.name} adicionado ao carrinho.`;
  showSalesToast(`${product.name} adicionado ao carrinho.`);
}

function updatePosCartQuantity(container, itemId, delta) {
  const item = salesState.cart.find((entry) => entry.id === itemId);
  if (!item) return;
  const product = salesState.products.find((entry) => entry.id === item.productId);
  const variation = product?.colors.flatMap((color) => color.variations).find((entry) => entry.id === item.variationId);
  const next = item.quantity + delta;
  if (next < 1) return removeCartItem(container, itemId);
  if (next > getAvailableQuantity(variation)) return;
  item.quantity = next;
  item.subtotal = item.unitPrice * next;
  renderCart(container);
  showSalesToast('Quantidade atualizada.');
}

async function loadNewSaleData(container) {
  try {
    const [customers, products] = await Promise.all([loadCustomers(), salesState.isAdmin ? loadAdminProducts() : loadSellerProducts(), loadStoreConfig()]);
    salesState.customers = customers;
    salesState.products = products;
    salesState.selectedCustomer = getDefaultCustomer();
    const firstProduct = products.find((product) => getProductStock(product) > 0) || products[0] || null;
    salesState.expandedProductId = firstProduct?.id || null;
    selectInitialVariation(firstProduct);
    renderPosCustomerArea(container);
    renderPosProductList(container);
    renderCart(container);
    container.querySelector('[data-pos-product-search]')?.focus();
  } catch (error) {
    console.error('Erro ao carregar nova venda:', error);
    const list = container.querySelector('[data-pos-product-list]');
    if (list) list.innerHTML = `<div class="ds-empty"><strong>Não foi possível carregar os produtos</strong><span>${escapeHtml(error.message)}</span></div>`;
    showSalesToast('Erro ao carregar produtos.', 'danger');
  }
}

function bindNewSaleEvents(container) {
  const signal = salesState.abortController.signal;
  const form = container.querySelector('[data-sale-form]');
  form.addEventListener('submit', (event) => submitSale(container, event), { signal });
  container.addEventListener('input', (event) => {
    if (event.target.matches('[data-pos-product-search]')) { salesState.productSearch = event.target.value; renderPosProductList(container); }
    if (event.target.matches('[data-sale-customer-search]')) { salesState.customerSearch = event.target.value; renderPosCustomerArea(container); container.querySelector('[data-sale-customer-search]')?.focus(); }
    if (event.target.matches('[data-pos-quantity-input]')) { salesState.itemQuantity = Math.max(1, Number(event.target.value || 1)); }
    if (event.target.matches('[name="discount_value"]')) { salesState.discountValue = parseNumber(event.target.value); renderTotals(container); }
  }, { signal });
  container.addEventListener('change', (event) => {
    if (event.target.matches('[data-invoice-requested]')) { form.elements.invoice_requested.value = event.target.checked ? 'yes' : 'no'; syncFiscalFields(container); }
  }, { signal });
  container.addEventListener('click', (event) => {
    const target = event.target;
    const productToggle = target.closest('[data-toggle-product]');
    const colorButton = target.closest('[data-select-color]');
    const variationButton = target.closest('[data-select-variation]');
    const quantityButton = target.closest('[data-pos-quantity]');
    const cartQuantity = target.closest('[data-cart-quantity]');
    if (productToggle) { const product = salesState.products.find((item) => item.id === productToggle.dataset.toggleProduct); const closing = salesState.expandedProductId === product.id; salesState.expandedProductId = closing ? null : product.id; if (!closing) selectInitialVariation(product); renderPosProductList(container); return; }
    if (colorButton) { salesState.selectedColorId = colorButton.dataset.selectColor; const color = getPosColor(); salesState.selectedVariationId = color?.variations.find((item) => getAvailableQuantity(item) > 0)?.id || null; salesState.itemQuantity = 1; renderPosProductList(container); return; }
    if (variationButton) { salesState.selectedVariationId = variationButton.dataset.selectVariation; salesState.itemQuantity = 1; renderPosProductList(container); return; }
    if (quantityButton) { const available = getAvailableQuantity(getPosVariation()); salesState.itemQuantity = Math.min(Math.max(1, salesState.itemQuantity + Number(quantityButton.dataset.posQuantity)), available || 1); renderPosProductList(container); return; }
    if (target.closest('[data-add-pos-item]')) { addPosCartItem(container); return; }
    if (target.closest('[data-add-other-variation]')) { salesState.selectedVariationId = null; salesState.itemQuantity = 1; renderPosProductList(container); return; }
    if (cartQuantity) { updatePosCartQuantity(container, cartQuantity.dataset.cartQuantity, Number(cartQuantity.dataset.delta)); return; }
    if (target.closest('[data-remove-sale-item]')) { removeCartItem(container, target.closest('[data-remove-sale-item]').dataset.removeSaleItem); return; }
    if (target.closest('[data-clear-cart]')) { salesState.cart = []; renderCart(container); return; }
    if (target.closest('[data-select-sale-customer]')) { selectSaleCustomer(container, target.closest('[data-select-sale-customer]').dataset.selectSaleCustomer); return; }
    if (target.closest('[data-clear-sale-customer]')) { clearSaleCustomer(container); return; }
    if (target.closest('[data-toggle-sale-customer-form]')) { salesState.showCustomerForm = true; renderPosCustomerArea(container); return; }
    if (target.closest('[data-cancel-sale-customer-form]')) { salesState.showCustomerForm = false; renderPosCustomerArea(container); return; }
    if (target.closest('[data-save-sale-customer]')) { saveInlineCustomer(container); return; }
    if (target.closest('[data-toggle-fiscal-panel]')) { const panel = container.querySelector('[data-sale-fiscal-panel]'); panel.hidden = !panel.hidden; return; }
    if (target.closest('[data-focus-product-search]')) container.querySelector('[data-pos-product-search]')?.focus();
  }, { signal });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'F2') { event.preventDefault(); container.querySelector('[data-pos-product-search]')?.focus(); }
    if (event.key === 'F3') { event.preventDefault(); salesState.showCustomerForm = true; renderPosCustomerArea(container); }
    if (event.key === 'F10') { event.preventDefault(); if (salesState.cart.length) form.requestSubmit(); }
    if (event.key === 'Escape') window.location.hash = '#/vendas';
  }, { signal });
}

function bindSalesEvents(container) {
  const signal = salesState.abortController.signal;
  const filters = container.querySelector('[data-sales-filters]');

  const syncFilters = () => {
    salesState.filters.search = filters.elements.search?.value || '';
    salesState.filters.customer = filters.elements.customer?.value || '';
    salesState.filters.number = filters.elements.number?.value || '';
    salesState.filters.dateFrom = filters.elements.date_from?.value || '';
    salesState.filters.dateTo = filters.elements.date_to?.value || '';
    salesState.filters.payment = filters.elements.payment?.value || 'all';
    salesState.filters.status = filters.elements.status?.value || 'all';
    salesState.currentPage = 1;
    renderSalesList(container);
  };

  filters.addEventListener('input', syncFilters, { signal });

  filters.addEventListener('change', syncFilters, { signal });

  container.querySelector('[data-new-sale]')?.addEventListener('click', () => openSaleModal(container), { signal });
  container.querySelector('[data-sale-form]')?.addEventListener('submit', (event) => submitSale(container, event), { signal });
  container.querySelector('[data-cancel-sale-form]')?.addEventListener('submit', (event) => submitCancelSale(container, event), { signal });

  container.querySelectorAll('[data-close-sale-modal]').forEach((button) => {
    button.addEventListener('click', () => closeSaleModal(container), { signal });
  });

  container.querySelectorAll('[data-close-sale-details-modal]').forEach((button) => {
    button.addEventListener('click', () => closeSaleDetails(container), { signal });
  });

  container.querySelectorAll('[data-close-sale-receipt-modal]').forEach((button) => {
    button.addEventListener('click', () => closeSaleReceipt(container), { signal });
  });

  container.querySelectorAll('[data-close-sale-whatsapp-modal]').forEach((button) => {
    button.addEventListener('click', () => closeSaleWhatsappModal(container), { signal });
  });

  container.querySelectorAll('[data-close-sale-whatsapp-success-modal]').forEach((button) => {
    button.addEventListener('click', () => closeSaleWhatsappSuccessModal(container), { signal });
  });

  container.querySelectorAll('[data-close-cancel-sale-modal]').forEach((button) => {
    button.addEventListener('click', () => closeCancelSaleModal(container), { signal });
  });

  container.addEventListener('change', (event) => {
    if (event.target.matches('[data-sale-product]')) updateColorOptions(container);
    if (event.target.matches('[data-sale-color]')) updateVariationOptions(container);
    if (event.target.matches('[data-sale-variation]')) updateAvailableStock(container);
    if (event.target.matches('[name="discount_type"]')) {
      salesState.discountType = event.target.value;
      renderTotals(container);
    }
    if (event.target.matches('[name="invoice_requested"]')) {
      syncFiscalFields(container);
    }
  }, { signal });

  container.addEventListener('input', (event) => {
    if (event.target.matches('[data-sale-customer-search]')) {
      salesState.customerSearch = event.target.value;
      renderCustomerArea(container);
      const nextInput = container.querySelector('[data-sale-customer-search]');
      nextInput?.focus();
      nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
      return;
    }

    if (event.target.matches('[name="discount_value"]')) {
      salesState.discountValue = parseNumber(event.target.value);
      renderTotals(container);
    }
  }, { signal });

  container.addEventListener('click', (event) => {
    const closeSaleDetailsButton = event.target.closest('[data-close-sale-details-modal]');
    const saleDetailsBackdrop = event.target.matches('[data-sale-details-modal]');
    const addItemButton = event.target.closest('[data-add-sale-item]');
    const removeItemButton = event.target.closest('[data-remove-sale-item]');
    const viewButton = event.target.closest('[data-view-sale]');
    const editButton = event.target.closest('[data-edit-sale]');
    const receiptButton = event.target.closest('[data-open-sale-receipt]');
    const cancelSaleButton = event.target.closest('[data-open-cancel-sale]');
    const printButton = event.target.closest('[data-print-sale]');
    const whatsappButton = event.target.closest('[data-send-sale-whatsapp]');
    const openWhatsappButton = event.target.closest('[data-open-sale-whatsapp]');
    const confirmWhatsappButton = event.target.closest('[data-confirm-sale-whatsapp]');
    const closeWhatsappModalButton = event.target.closest('[data-close-sale-whatsapp-modal]');
    const closeWhatsappSuccessButton = event.target.closest('[data-close-sale-whatsapp-success-modal]');
    const receiptBackButton = event.target.closest('[data-back-sale-details]');
    const saleMoreToggle = event.target.closest('[data-sale-more-toggle]');
    const saleMoreMenu = event.target.closest('[data-sale-more-menu]');
    const duplicateSaleButton = event.target.closest('[data-duplicate-sale]');
    const selectCustomerButton = event.target.closest('[data-select-sale-customer]');
    const clearCustomerButton = event.target.closest('[data-clear-sale-customer]');
    const toggleCustomerFormButton = event.target.closest('[data-toggle-sale-customer-form]');
    const cancelCustomerFormButton = event.target.closest('[data-cancel-sale-customer-form]');
    const saveCustomerButton = event.target.closest('[data-save-sale-customer]');
    const actionsTrigger = event.target.closest('[data-sale-actions-trigger]');
    const actionsMenu = event.target.closest('[data-sale-actions-menu]');
    const directReceipt = event.target.closest('[data-direct-sale-receipt]');
    const directWhatsApp = event.target.closest('[data-direct-sale-whatsapp]');
    const directCancel = event.target.closest('[data-direct-cancel-sale]');
    const requestInvoice = event.target.closest('[data-request-sale-invoice]');
    const drawerEditButton = event.target.closest('[data-edit-sale-drawer]');
    const todayButton = event.target.closest('[data-sales-today]');
    const clearFiltersButton = event.target.closest('[data-sales-filters-clear]');
    const paginationButton = event.target.closest('[data-sales-page]');

    if (closeSaleDetailsButton || saleDetailsBackdrop) {
      closeSaleDetails(container);
      return;
    }

    if (closeWhatsappModalButton) {
      closeSaleWhatsappModal(container);
      return;
    }

    if (closeWhatsappSuccessButton) {
      closeSaleWhatsappSuccessModal(container);
      return;
    }

    if (receiptBackButton) {
      backToSaleDetails(container);
      return;
    }

    if (!saleMoreToggle && !saleMoreMenu) {
      container.querySelectorAll('[data-sale-more-menu]').forEach((item) => { item.hidden = true; });
    }

    if (saleMoreToggle) {
      const menu = container.querySelector('[data-sale-more-menu]');
      if (menu) menu.hidden = !menu.hidden;
      return;
    }

    if (!actionsTrigger && !actionsMenu) {
      container.querySelectorAll('[data-sale-actions-menu]').forEach((item) => {
        item.hidden = true;
      });
    }

    if (actionsTrigger) {
      const menu = container.querySelector(`[data-sale-actions-menu="${actionsTrigger.dataset.saleActionsTrigger}"]`);
      container.querySelectorAll('[data-sale-actions-menu]').forEach((item) => { if (item !== menu) item.hidden = true; });
      if (menu) menu.hidden = !menu.hidden;
      return;
    }

    if (paginationButton && !paginationButton.disabled) {
      const targetPage = paginationButton.dataset.salesPage;
      if (targetPage === 'previous') salesState.currentPage -= 1;
      else if (targetPage === 'next') salesState.currentPage += 1;
      else salesState.currentPage = Number(targetPage) || 1;
      renderSalesList(container);
      container.querySelector('.sales-list-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (todayButton) {
      const filtersForm = container.querySelector('[data-sales-filters]');
      if (filtersForm) {
        const today = new Date().toISOString().slice(0, 10);
        filtersForm.elements.date_from.value = today;
        filtersForm.elements.date_to.value = today;
        salesState.filters.dateFrom = today;
        salesState.filters.dateTo = today;
        salesState.currentPage = 1;
        renderSalesList(container);
      }
      return;
    }

    if (clearFiltersButton) {
      const filtersForm = container.querySelector('[data-sales-filters]');
      if (filtersForm) {
        filtersForm.reset();
        salesState.filters = { search: '', customer: '', number: '', dateFrom: '', dateTo: '', payment: 'all', status: 'all' };
        salesState.currentPage = 1;
        renderSalesList(container);
      }
      return;
    }

    if (directReceipt) {
      openSaleReceipt(container, salesState.sales.find((sale) => sale.id === directReceipt.dataset.directSaleReceipt));
      return;
    }

    if (directWhatsApp) {
      salesState.viewingSale = salesState.sales.find((sale) => sale.id === directWhatsApp.dataset.directSaleWhatsapp) || null;
      openSaleReceipt(container, salesState.viewingSale);
      openSaleWhatsappModal(container, salesState.viewingSale);
      return;
    }

    if (directCancel) {
      openCancelSaleModal(container, salesState.sales.find((sale) => sale.id === directCancel.dataset.directCancelSale));
      return;
    }

    if (requestInvoice) {
      const targetSale = salesState.sales.find((sale) => sale.id === requestInvoice.dataset.requestSaleInvoice);
      if (targetSale) {
        window.location.hash = `#/vendas/nova?edit=${targetSale.id}`;
      }
      return;
    }

    if (selectCustomerButton) {
      selectSaleCustomer(container, selectCustomerButton.dataset.selectSaleCustomer);
      return;
    }

    if (clearCustomerButton) {
      clearSaleCustomer(container);
      return;
    }

    if (toggleCustomerFormButton) {
      salesState.showCustomerForm = true;
      renderCustomerArea(container);
      return;
    }

    if (cancelCustomerFormButton) {
      salesState.showCustomerForm = false;
      renderCustomerArea(container);
      return;
    }

    if (saveCustomerButton) {
      saveInlineCustomer(container);
      return;
    }

    if (addItemButton) {
      addCartItem(container);
      return;
    }

    if (removeItemButton) {
      removeCartItem(container, removeItemButton.dataset.removeSaleItem);
      return;
    }

    if (viewButton) {
      openSaleDetails(container, viewButton.dataset.viewSale);
      return;
    }

    if (editButton) {
      window.location.hash = `#/vendas/nova?edit=${editButton.dataset.editSale}`;
      return;
    }

    if (receiptButton) {
      openSaleReceipt(container);
      return;
    }

    if (duplicateSaleButton) {
      duplicateSaleToModal(container);
      return;
    }

    if (drawerEditButton) {
      if (salesState.viewingSale) {
        window.location.hash = `#/vendas/nova?edit=${salesState.viewingSale.id}`;
      }
      return;
    }

    if (cancelSaleButton) {
      openCancelSaleModal(container);
      return;
    }

    if (printButton) {
      const targetSale = printButton.dataset.saleId
        ? salesState.sales.find((sale) => sale.id === printButton.dataset.saleId)
        : null;
      if (targetSale) {
        openSaleReceipt(container, targetSale);
      }
      if (printButton.dataset.printSale === 'pdf') {
        downloadSaleReceiptPdf(container, printButton);
      } else {
        printSaleReceipt(container);
      }
      return;
    }

    if (openWhatsappButton) {
      openSaleWhatsappModal(container);
      return;
    }

    if (confirmWhatsappButton) {
      sendSaleWhatsApp(container);
      return;
    }

    if (whatsappButton) {
      openSaleWhatsappModal(container);
    }
  }, { signal });
}

export function renderSales(container, route, { profile }) {
  salesState.abortController?.abort();
  salesState.abortController = new AbortController();
  salesState.profile = profile;
  salesState.isAdmin = isAdmin(profile);
  salesState.cart = [];
  salesState.selectedCustomer = null;
  salesState.customerSearch = '';
  salesState.showCustomerForm = false;
  salesState.editingSale = null;
  salesState.viewingSale = null;
  salesState.receiptSale = null;
  salesState.cancellingSale = null;
  salesState.filters = { search: '', customer: '', number: '', dateFrom: '', dateTo: '', payment: 'all', status: 'all' };
  salesState.currentPage = 1;
  salesState.discountType = 'value';
  salesState.discountValue = 0;
  salesState.fiscalRequested = false;
  salesState.fiscalDocument = '';
  salesState.fiscalNotes = '';

  renderSalesLayout(container, route);
  bindSalesEvents(container);
  loadSalesData(container);
}

export function renderNewSale(container, route, { profile }) {
  const editSaleId = getSaleEditIdFromHash();
  const editingSale = editSaleId ? salesState.sales.find((sale) => sale.id === editSaleId) || null : null;
  salesState.abortController?.abort();
  salesState.abortController = new AbortController();
  salesState.profile = profile;
  salesState.isAdmin = isAdmin(profile);
  salesState.cart = [];
  salesState.customers = [];
  salesState.products = [];
  salesState.selectedCustomer = null;
  salesState.customerSearch = '';
  salesState.showCustomerForm = false;
  salesState.editingSale = editingSale;
  salesState.expandedProductId = null;
  salesState.selectedColorId = null;
  salesState.selectedVariationId = null;
  salesState.productSearch = '';
  salesState.itemQuantity = 1;
  salesState.discountType = 'value';
  salesState.discountValue = 0;
  salesState.fiscalRequested = false;
  salesState.fiscalDocument = '';
  salesState.fiscalNotes = '';
  renderNewSaleLayout(container, route);
  bindNewSaleEvents(container);
  renderCart(container);
  loadNewSaleData(container).then(() => {
    if (editingSale) {
      prepareSaleEdit(container, editingSale);
      const newSaleTitle = container.querySelector('[data-new-sale-title]');
      const newSaleMode = container.querySelector('[data-new-sale-mode]');
      if (newSaleTitle) newSaleTitle.textContent = `Editar Venda ${formatSaleOperationNumber(editingSale)}`;
      if (newSaleMode) newSaleMode.textContent = 'Editando venda';
      const submitButton = container.querySelector('[data-finalize-sale]');
      if (submitButton) submitButton.textContent = 'Salvar alterações ✓';
      container.querySelector('[data-edit-reason-area]')?.removeAttribute('hidden');
    }
  });
}
