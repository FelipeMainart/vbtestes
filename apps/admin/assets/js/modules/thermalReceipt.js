const html = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const money = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});

const icon = (name) => {
  const paths = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-7.6a5.5 5.5 0 0 0 1-8.8Z"/>',
    whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M17.5 6.5h.01"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
};

export function renderThermalReceipt(data) {
  const { sale, customer, items, fiscal, invoiceRequested, observations, number, payment, store } = data;
  const date = sale.created_at ? new Date(sale.created_at) : null;
  const dateLabel = date ? date.toLocaleDateString('pt-BR') : '—';
  const timeLabel = date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const address = String(store.address || '').trim() || 'Shopping Via Norte|Rua 300 - Goiânia/GO';
  const addressParts = address.split(/[|,]/).map((part) => part.trim()).filter(Boolean);

  return `<article class="thermal-receipt" data-thermal-receipt>
    <header class="thermal-receipt__header">
      <img class="thermal-receipt__logo" src="${html(store.logo)}" alt="${html(store.name)}">
      <div class="thermal-receipt__rule"></div>
      <h3>RECIBO DE VENDA</h3>
      <strong class="thermal-receipt__number">${html(number)}</strong>
      <time>${html(dateLabel)} ${html(timeLabel)}</time>
    </header>
    <section class="thermal-receipt__customer">
      <div><span>Cliente</span><strong>${html(sale.customer_name || customer?.name || 'Cliente Diversos')}</strong></div>
      <div><span>WhatsApp</span><strong>${html(customer?.whatsapp || '—')}</strong></div>
    </section>
    <section class="thermal-receipt__items">
      <div class="thermal-receipt__section-title"><strong>PRODUTO</strong><span>QTD</span><span>VALOR</span></div>
      ${items.map((item) => `<article class="thermal-receipt__item">
        <strong>${html(item.product_name || 'Produto')}</strong>
        <small>${html([item.color, item.size].filter(Boolean).join(' • ') || '—')}</small>
        <div><span>${Number(item.quantity || 0)} x ${money(item.unit_price)}</span><strong>${money(item.subtotal)}</strong></div>
      </article>`).join('') || '<p class="thermal-receipt__empty">Itens não disponíveis.</p>'}
    </section>
    <section class="thermal-receipt__totals">
      <div><span>Subtotal</span><strong>${money(sale.gross_total)}</strong></div>
      <div><span>Desconto</span><strong>${money(sale.discount)}</strong></div>
      <div class="thermal-receipt__total"><span>TOTAL</span><strong>${money(sale.net_total)}</strong></div>
    </section>
    <section class="thermal-receipt__payment">
      <div><span>Pagamento</span><strong>${html(payment || '—')}</strong></div>
      ${invoiceRequested ? `<div><span>NF solicitada</span><strong>Sim</strong></div><div><span>CPF/CNPJ</span><strong>${html(fiscal.fiscalDocument || '—')}</strong></div>` : ''}
      ${fiscal.fiscalNotes || observations ? `<div><span>Observações fiscais</span><strong>${html(fiscal.fiscalNotes || observations)}</strong></div>` : ''}
    </section>
    <section class="thermal-receipt__thanks">${icon('heart')}<div><strong>Obrigado pela preferência!</strong><span>Sua satisfação é o que nos motiva a entregar sempre o melhor.</span></div></section>
    <footer class="thermal-receipt__footer">
      <div>${icon('whatsapp')}<p><span>WhatsApp</span><strong>${html(store.whatsapp || store.phone || '62 99480-1843')}</strong></p></div>
      <div>${icon('instagram')}<p><span>Instagram</span><strong>${html(store.instagram || '@vbmodaalfaiataria')}</strong></p></div>
      <div>${icon('pin')}<p><span>Endereço</span><strong>${addressParts.map(html).join('<br>')}</strong></p></div>
    </footer>
  </article>`;
}

export function thermalReceiptFilename(number) {
  const safe = String(number || '').trim().replace(/[^A-Za-z0-9-]/g, '');
  return `VB_Recibo_${safe || 'Venda'}.pdf`;
}
