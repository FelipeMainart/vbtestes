import {
  ArrowLeft,
  CalendarDays,
  Check,
  CreditCard,
  LockKeyhole,
  Mail,
  PackageSearch,
  Plus,
  ReceiptText,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { WHATSAPP_URL } from "@/constants/contact";
import { ROUTES } from "@/constants/routes";

import type { MockOrder } from "../../domain/entities/order";
import {
  formatOrderDate,
  formatOrderWeekday,
  getEstimatedDeliveryDate,
} from "./order-presentation";
import { OrderStatusSummary } from "./order-status-summary";
import styles from "./order-success.module.css";

export function OrderSuccessPage({ order }: Readonly<{ order: MockOrder }>) {
  const deliveryDate = getEstimatedDeliveryDate(
    order.createdAt,
    order.review.shipping.deliveryEstimate,
  );

  return (
    <div className={styles.pageShell}>
      <header className={styles.pageHeader}>
        <div>
          <Link aria-label="Veste Bem, voltar para a loja" href={ROUTES.home}>
            <Image
              alt="Veste Bem Moda Alfaiataria"
              className={styles.logo}
              height={36}
              priority
              src="/images/brand/veste-bem-logo.webp"
              width={216}
            />
          </Link>
          <span>
            <LockKeyhole aria-hidden="true" size={16} /> Pedido seguro
          </span>
          <Link href={ROUTES.home}>
            <ArrowLeft aria-hidden="true" size={16} /> Voltar para a loja
          </Link>
        </div>
      </header>

      <main className={styles.page}>
        <section className={styles.confirmation}>
          <span className={styles.successIcon}>
            <Check aria-hidden="true" size={34} strokeWidth={1.7} />
          </span>
          <p className={styles.badge}>Pedido realizado</p>
          <h1>Pedido recebido com sucesso!</h1>
          <p className={styles.lead}>
            Recebemos seu pedido e já estamos preparando tudo com muito cuidado.
            Enviaremos atualizações por e-mail e WhatsApp.
          </p>
          <div className={styles.orderNumber}>
            <ReceiptText aria-hidden="true" size={26} />
            <span>
              <small>Número do pedido</small>
              <strong>{order.number}</strong>
            </span>
          </div>
          <div className={styles.actions}>
            <Link
              className="ds-button ds-button--primary"
              href={ROUTES.tracking as Route}
            >
              <PackageSearch aria-hidden="true" size={18} /> Acompanhar Pedido
            </Link>
            <Link className="ds-button ds-button--secondary" href={ROUTES.home}>
              <Plus aria-hidden="true" size={18} /> Nova Compra
            </Link>
            <a
              className="ds-button ds-button--secondary"
              href={WHATSAPP_URL}
              rel="noreferrer"
              target="_blank"
            >
              <WhatsAppIcon aria-hidden="true" height={18} width={18} />
              WhatsApp
            </a>
          </div>
        </section>

        <aside className={styles.summary} aria-label="Status do pedido">
          <OrderStatusSummary order={order} />
        </aside>

        <section className={styles.details} aria-label="Informações da entrega">
          <div className={styles.quickFacts}>
            <div>
              <CalendarDays aria-hidden="true" size={21} />
              <span>
                <strong>Previsão de entrega</strong>
                <b>Até {formatOrderDate(deliveryDate)}</b>
                <small>{formatOrderWeekday(deliveryDate)}</small>
              </span>
            </div>
            <div>
              <Truck aria-hidden="true" size={22} />
              <span>
                <strong>Forma de entrega</strong>
                <b>{order.review.shipping.label}</b>
                <small>{order.review.shipping.deliveryEstimate}</small>
              </span>
            </div>
            <div>
              <CreditCard aria-hidden="true" size={21} />
              <span>
                <strong>Forma de pagamento</strong>
                <b>{order.review.payment.label}</b>
                <small>Pagamento aprovado</small>
              </span>
            </div>
          </div>

          <div className={styles.contact} id="atendimento">
            <span aria-hidden="true">
              <Mail size={24} />
            </span>
            <p>
              Enviamos os detalhes do seu pedido para
              <strong>{order.review.customer.email}</strong>
              <small>
                Fique de olho no seu e-mail e no WhatsApp
                {order.review.customer.phone
                  ? ` ${order.review.customer.phone}`
                  : ""}{" "}
                para acompanhar cada etapa.
              </small>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
