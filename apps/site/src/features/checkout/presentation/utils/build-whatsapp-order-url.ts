import { WHATSAPP_PHONE } from "@/constants/contact";
import type { CheckoutReview } from "../../domain/entities/checkout";
import { formatCheckoutPrice } from "./format-checkout-price";

function optionalLine(label: string, value: string | undefined) {
  return value?.trim() ? `${label}: ${value.trim()}` : null;
}

export function buildWhatsappOrderMessage(review: CheckoutReview) {
  const { address, customer, payment, shipping, snapshot } = review;
  const customerName = `${customer.firstName} ${customer.lastName}`.trim();
  const addressLines = [
    `Rua: ${address.street}, ${address.number}`,
    optionalLine("Complemento", address.complement),
    `Bairro: ${address.neighborhood}`,
    `Cidade/UF: ${address.city}/${address.state}`,
    `CEP: ${address.postalCode}`,
  ].filter((line): line is string => Boolean(line));
  const productLines = snapshot.lines.map(
    (line) =>
      `• ${line.quantity}x ${line.name} | ${line.reference} | Cor: ${line.colorLabel} | Tamanho: ${line.sizeLabel} | ${formatCheckoutPrice(line.quantity * line.priceInCents)}`,
  );

  return [
    "Olá! Vim pelo site da Veste Bem e quero finalizar este pedido:",
    "",
    "*DADOS DO CLIENTE*",
    `Nome: ${customerName}`,
    `Telefone: ${customer.phone}`,
    `E-mail: ${customer.email}`,
    optionalLine("CPF", customer.cpf),
    "",
    "*ITENS DO PEDIDO*",
    ...productLines,
    `Total de peças: ${snapshot.summary.totalPieces}`,
    "",
    "*ENTREGA*",
    `Modalidade: ${shipping.label}`,
    `Prazo estimado: ${shipping.deliveryEstimate}`,
    `Valor estimado: ${formatCheckoutPrice(shipping.priceInCents)}`,
    ...addressLines,
    "",
    "*PAGAMENTO*",
    `Preferência: ${payment.label}`,
    "A forma final de pagamento será confirmada pela equipe no WhatsApp.",
    "",
    "*RESUMO*",
    `Subtotal: ${formatCheckoutPrice(snapshot.summary.subtotalInCents)}`,
    `Total estimado: ${formatCheckoutPrice(review.totalInCents)}`,
    "",
    "Por favor, confirme disponibilidade, frete e condições para eu concluir a compra.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function buildWhatsappOrderUrl(review: CheckoutReview) {
  const message = buildWhatsappOrderMessage(review);
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}
