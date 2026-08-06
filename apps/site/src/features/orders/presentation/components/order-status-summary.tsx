import {
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  MapPin,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { WHATSAPP_URL } from "@/constants/contact";
import { ROUTES } from "@/constants/routes";
import { formatCheckoutPrice } from "@/features/checkout/presentation/utils/format-checkout-price";

import type { MockOrder } from "../../domain/entities/order";
import {
  formatOrderDate,
  formatOrderTime,
  getEstimatedDeliveryDate,
} from "./order-presentation";
import styles from "./order-status-summary.module.css";

export function OrderStatusSummary({ order }: Readonly<{ order: MockOrder }>) {
  const { review } = order;
  const totalPieces = review.snapshot.summary.totalPieces;
  const deliveryDate = getEstimatedDeliveryDate(
    order.createdAt,
    review.shipping.deliveryEstimate,
  );

  return (
    <section className={styles.panel} aria-labelledby="order-panel-title">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Check size={24} strokeWidth={2} />
        </span>
        <div className={styles.headerCopy}>
          <h2 id="order-panel-title">Seu pedido</h2>
          <strong>
            <i aria-hidden="true" /> Pedido confirmado
          </strong>
          <p>Estamos preparando tudo com muito cuidado.</p>
        </div>
        <span className={styles.quantity}>
          <b>{totalPieces}</b>
          {totalPieces === 1 ? "item" : "itens"}
        </span>
      </header>

      <ul className={styles.products} aria-label="Produtos confirmados">
        {review.snapshot.lines.map((line) => (
          <li key={line.variationId}>
            <Image
              alt={line.imageAlt}
              height={104}
              src={line.imageUrl}
              width={80}
            />
            <div>
              <strong>{line.name}</strong>
              <span>
                {line.reference} · {line.colorLabel} · {line.sizeLabel}
              </span>
              <span>
                {line.quantity} × {formatCheckoutPrice(line.priceInCents)}
              </span>
            </div>
            <strong>
              {formatCheckoutPrice(line.priceInCents * line.quantity)}
            </strong>
          </li>
        ))}
      </ul>

      <dl className={styles.orderFacts} id="order-details">
        <div>
          <span aria-hidden="true">
            <ReceiptText size={19} />
          </span>
          <dt>Pedido</dt>
          <dd>{order.number}</dd>
        </div>
        <div>
          <span aria-hidden="true">
            <CalendarDays size={19} />
          </span>
          <dt>Realizado em</dt>
          <dd>{formatOrderDate(order.createdAt)}</dd>
          <small>{formatOrderTime(order.createdAt)}</small>
        </div>
        <div>
          <span aria-hidden="true">
            <CreditCard size={19} />
          </span>
          <dt>Pagamento</dt>
          <dd>{review.payment.label}</dd>
          <small className={styles.approved}>Aprovado</small>
        </div>
        <div>
          <span aria-hidden="true">
            <Truck size={19} />
          </span>
          <dt>Entrega</dt>
          <dd>{review.shipping.label}</dd>
          <small>{review.shipping.deliveryEstimate}</small>
        </div>
        <div>
          <span aria-hidden="true">
            <Clock3 size={19} />
          </span>
          <dt>Previsão de entrega</dt>
          <dd>{formatOrderDate(deliveryDate)}</dd>
        </div>
        <div>
          <span aria-hidden="true">
            <MapPin size={19} />
          </span>
          <dt>Endereço de entrega</dt>
          <dd>
            {review.address.city} - {review.address.state}
          </dd>
        </div>
      </dl>

      <dl className={styles.values}>
        <div>
          <dt>Subtotal</dt>
          <dd>
            {formatCheckoutPrice(review.snapshot.summary.subtotalInCents)}
          </dd>
        </div>
        <div>
          <dt>Entrega ({review.shipping.label})</dt>
          <dd>{formatCheckoutPrice(review.shipping.priceInCents)}</dd>
        </div>
      </dl>

      <section className={styles.total} aria-label="Total confirmado">
        <div>
          <strong>Valor do pedido</strong>
          <span>
            <ShieldCheck aria-hidden="true" size={18} /> Pagamento aprovado
          </span>
        </div>
        <div>
          <span>Total confirmado</span>
          <strong>{formatCheckoutPrice(review.totalInCents)}</strong>
        </div>
      </section>

      <footer className={styles.quickActions} aria-label="Ações do pedido">
        <Link href={ROUTES.tracking as Route}>
          <PackageSearch aria-hidden="true" size={24} />
          <strong>Acompanhar entrega</strong>
          <span>Veja o status do seu pedido</span>
        </Link>
        <a href={WHATSAPP_URL} rel="noreferrer" target="_blank">
          <WhatsAppIcon aria-hidden="true" height={24} width={24} />
          <strong>Falar no WhatsApp</strong>
          <span>Atendimento rápido e humanizado</span>
        </a>
        <a href="#order-details">
          <PackageCheck aria-hidden="true" size={24} />
          <strong>Ver detalhes do pedido</strong>
          <span>Confira todos os itens e informações</span>
        </a>
      </footer>
    </section>
  );
}
