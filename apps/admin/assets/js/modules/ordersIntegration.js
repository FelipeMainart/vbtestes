const ORDER_EXPIRATION_HOURS = 24;

export const onlineOrderStatuses = [
  'awaiting_payment', 'paid', 'in_separation', 'awaiting_shipping',
  'shipped', 'delivered', 'finalized', 'cancelled', 'expired',
];

export function getOrderIdempotencyKey(payload) {
  return `${payload?.source || 'unknown'}:${payload?.external_order_id || ''}`;
}

export function validateIncomingOrderPayload(payload) {
  const errors = [];
  if (!payload?.external_order_id) errors.push('external_order_id é obrigatório');
  if (!payload?.source) errors.push('source é obrigatório');
  if (!payload?.created_at) errors.push('created_at é obrigatório');
  if (!payload?.customer?.name) errors.push('customer.name é obrigatório');
  if (!Array.isArray(payload?.items) || !payload.items.length) errors.push('items deve conter ao menos um item');
  if (payload?.payment?.status && !['pending', 'paid', 'expired', 'failed', 'refunded', 'partially_refunded'].includes(payload.payment.status)) errors.push('payment.status inválido');
  return { valid: errors.length === 0, errors };
}

export function getReservationExpiration(createdAt, hours = ORDER_EXPIRATION_HOURS) {
  return new Date(new Date(createdAt).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function shouldExpireReservation(order, now = new Date()) {
  return order?.order_status === 'awaiting_payment'
    && order?.stock_reservation_status === 'reserved'
    && order?.stock_reservation_expires_at
    && new Date(order.stock_reservation_expires_at) <= now;
}

export { ORDER_EXPIRATION_HOURS };
