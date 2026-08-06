import Image from "next/image";
import { Check, Circle, ShieldCheck, ShoppingBag, Truck } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import type { ShippingOption } from "@/services/interfaces/shipping-service";

import type { CheckoutSnapshot } from "../../domain/entities/checkout";
import { formatCheckoutPrice } from "../utils/format-checkout-price";
import styles from "./checkout.module.css";

type Props = Readonly<{
  currentStep: 0 | 1 | 2 | 3;
  shipping?: ShippingOption;
  snapshot: CheckoutSnapshot;
}>;

const milestones = ["Dados", "Entrega", "Pagamento", "Revisão"] as const;

export function CheckoutSummary({ currentStep, shipping, snapshot }: Props) {
  const total =
    snapshot.summary.subtotalInCents + (shipping?.priceInCents ?? 0);

  return (
    <div className={styles.summaryContent}>
      <header className={styles.summaryHeader}>
        <span className={styles.summaryHeaderIcon} aria-hidden="true">
          <ShoppingBag size={24} strokeWidth={1.7} />
        </span>
        <div className={styles.summaryTitle}>
          <h2>Seu pedido</h2>
          <span>
            <Check aria-hidden="true" size={13} strokeWidth={3} />
            Pedido mínimo atingido
          </span>
        </div>
        <strong
          className={styles.summaryQuantity}
          key={snapshot.summary.totalPieces}
        >
          <b>{snapshot.summary.totalPieces}</b>
          peças
        </strong>
      </header>

      <ul className={styles.summaryLines} aria-label="Produtos do pedido">
        {snapshot.lines.map((line) => (
          <li className={styles.summaryLine} key={line.variationId}>
            <Image
              alt={line.imageAlt}
              className={styles.summaryImage}
              height={112}
              src={line.imageUrl}
              width={88}
            />
            <div className={styles.summaryProduct}>
              <strong>{line.name}</strong>
              <span>
                {line.reference} · {line.colorLabel} · {line.sizeLabel}
              </span>
              <span>
                {line.quantity} × {formatCheckoutPrice(line.priceInCents)}
              </span>
            </div>
            <strong>
              {formatCheckoutPrice(line.quantity * line.priceInCents)}
            </strong>
          </li>
        ))}
      </ul>

      <ol className={styles.summaryProgress} aria-label="Progresso do checkout">
        {milestones.map((label, index) => {
          const status =
            currentStep === 3 || index < currentStep
              ? "complete"
              : index === currentStep
                ? "active"
                : "upcoming";

          return (
            <li
              aria-current={status === "active" ? "step" : undefined}
              data-status={status}
              key={label}
            >
              <span aria-hidden="true">
                {status === "complete" ? (
                  <Check size={17} strokeWidth={2.5} />
                ) : (
                  <Circle
                    fill={status === "active" ? "currentColor" : "none"}
                    size={status === "active" ? 9 : 14}
                  />
                )}
              </span>
              <b>{label}</b>
            </li>
          );
        })}
      </ol>

      <dl className={styles.summaryTotals}>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCheckoutPrice(snapshot.summary.subtotalInCents)}</dd>
        </div>
        <div>
          <dt>{shipping ? `Entrega (${shipping.label})` : "Entrega"}</dt>
          <dd>
            {shipping
              ? formatCheckoutPrice(shipping.priceInCents)
              : "A calcular"}
          </dd>
        </div>
      </dl>

      <section
        className={styles.summaryGrandTotal}
        aria-label="Total do pedido"
      >
        <div>
          <strong>Total do pedido</strong>
          <span>Valor final</span>
        </div>
        <div>
          <span className={styles.totalLabel}>Total</span>
          <strong className={styles.totalValue} key={total}>
            {formatCheckoutPrice(total)}
          </strong>
        </div>
        <p>
          <ShieldCheck aria-hidden="true" size={19} />
          Você está economizando tempo e cuidando do seu negócio.
        </p>
      </section>

      <footer className={styles.trustSignals} aria-label="Garantias da compra">
        <span>
          <ShieldCheck aria-hidden="true" size={25} />
          <strong>Compra segura</strong>
          <small>Tecnologia e criptografia para proteger seus dados</small>
        </span>
        <span>
          <Truck aria-hidden="true" size={27} />
          <strong>Entrega para todo o Brasil</strong>
          <small>Com as melhores transportadoras</small>
        </span>
        <span>
          <WhatsAppIcon aria-hidden="true" height={26} width={26} />
          <strong>Suporte via WhatsApp</strong>
          <small>Atendimento rápido e humanizado</small>
        </span>
      </footer>
    </div>
  );
}
