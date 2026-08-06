import { ArrowRight, MapPin, ShoppingBag, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ShippingOption } from "@/services/interfaces/shipping-service";

import type { OrderLine, OrderSummary } from "../../domain/entities/order-line";
import { formatCartPrice } from "../utils/format-cart-price";
import { CartLineItem } from "./cart-line-item";
import styles from "./cart-panel.module.css";

type CartSummaryContentProps = Readonly<{
  finalizationNotice: string | null;
  isCalculatingShipping: boolean;
  isUpdating: boolean;
  lines: readonly OrderLine[];
  onCalculateShipping: () => void;
  onDecrement: (variationId: string) => void;
  onFinalize: () => void;
  onIncrement: (variationId: string) => void;
  onPostalCodeChange: (value: string) => void;
  onRemove: (variationId: string) => void;
  onShippingChange: (id: ShippingOption["id"]) => void;
  postalCode: string;
  selectedShippingId: ShippingOption["id"] | null;
  showHeading: boolean;
  shippingMessage: string | null;
  shippingOptions: readonly ShippingOption[];
  summary: OrderSummary;
  surface: "dark" | "light";
}>;

function getProgressMessage(summary: OrderSummary) {
  switch (summary.progressState) {
    case "empty":
      return "Adicione 6 peças para montar seu pedido.";
    case "one-remaining":
      return "Falta apenas 1 peça para liberar seu pedido.";
    case "eligible":
      return "Pedido mínimo atingido. Você já pode finalizar.";
    case "below-minimum":
      return `Você tem ${summary.totalPieces} de ${summary.minimumPieces} peças. Faltam ${summary.missingPieces}.`;
  }
}

export function CartSummaryContent({
  finalizationNotice,
  isCalculatingShipping,
  isUpdating,
  lines,
  onCalculateShipping,
  onDecrement,
  onFinalize,
  onIncrement,
  onPostalCodeChange,
  onRemove,
  onShippingChange,
  postalCode,
  selectedShippingId,
  showHeading,
  shippingMessage,
  shippingOptions,
  summary,
  surface,
}: CartSummaryContentProps) {
  const selectedShipping = shippingOptions.find(
    (option) => option.id === selectedShippingId,
  );
  const estimatedTotal =
    summary.subtotalInCents + (selectedShipping?.priceInCents ?? 0);
  return (
    <div
      aria-busy={isUpdating}
      className={styles.cartContent}
      data-surface={surface}
    >
      {showHeading && (
        <div className={styles.cartHeading}>
          <span className={styles.cartHeadingIcon} aria-hidden="true">
            <ShoppingBag size={20} strokeWidth={2} />
          </span>
          <div>
            <h3>Seu Pedido</h3>
            <p>
              {summary.isEligible
                ? "Pedido mínimo atingido"
                : `Faltam ${summary.missingPieces} ${summary.missingPieces === 1 ? "peça" : "peças"}`}
            </p>
          </div>
          <strong className={styles.piecesBadge}>
            {summary.totalPieces} {summary.totalPieces === 1 ? "peça" : "peças"}
          </strong>
        </div>
      )}

      <div className={styles.progressCopy}>
        <strong className={styles.metricPulse} key={summary.totalPieces}>
          {summary.totalPieces} de {summary.minimumPieces} peças
        </strong>
        <span>
          {summary.missingPieces > 0
            ? `Faltam ${summary.missingPieces}`
            : "Mínimo atingido"}
        </span>
      </div>
      <progress
        aria-label="Progresso do pedido mínimo"
        className={styles.progressTrack}
        max={summary.minimumPieces}
        value={Math.min(summary.totalPieces, summary.minimumPieces)}
      />
      <p className={styles.progressMessage}>{getProgressMessage(summary)}</p>

      {lines.length > 0 ? (
        <ul className={styles.cartLines}>
          {lines.map((line) => (
            <CartLineItem
              key={line.variationId}
              isUpdating={isUpdating}
              line={line}
              onDecrement={onDecrement}
              onIncrement={onIncrement}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.emptyCart}>
          <span className={styles.emptyCartIcon} aria-hidden="true">
            <ShoppingBag size={22} strokeWidth={1.8} />
          </span>
          <span>
            <strong>Seu pedido ainda está vazio.</strong>
            <small>Escolha seus primeiros modelos.</small>
          </span>
        </div>
      )}

      {summary.isEligible && (
        <section
          className={styles.shippingEstimator}
          aria-labelledby="shipping-estimator-title"
        >
          <div className={styles.shippingEstimatorHeading}>
            <MapPin aria-hidden="true" size={17} />
            <div>
              <h4 id="shipping-estimator-title">Calcule a entrega</h4>
              <p>Consulte prazo e valor antes de finalizar.</p>
            </div>
          </div>
          <div className={styles.postalCodeForm}>
            <label>
              <span>CEP</span>
              <input
                className="ds-input"
                inputMode="numeric"
                onChange={(event) => onPostalCodeChange(event.target.value)}
                placeholder="00000-000"
                value={postalCode}
              />
            </label>
            <Button
              disabled={isCalculatingShipping}
              onClick={onCalculateShipping}
              variant="secondary"
            >
              {isCalculatingShipping ? "Consultando…" : "Consultar"}
            </Button>
          </div>
          {shippingOptions.length > 0 && (
            <fieldset className={styles.shippingOptions}>
              <legend className={styles.srOnly}>Escolha a entrega</legend>
              {shippingOptions.map((option) => (
                <label
                  data-selected={selectedShippingId === option.id}
                  key={option.id}
                >
                  <input
                    checked={selectedShippingId === option.id}
                    name="home-shipping"
                    onChange={() => onShippingChange(option.id)}
                    type="radio"
                  />
                  <Truck aria-hidden="true" size={16} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.deliveryEstimate}</small>
                  </span>
                  <strong>{formatCartPrice(option.priceInCents)}</strong>
                </label>
              ))}
            </fieldset>
          )}
          {shippingMessage && (
            <p className={styles.shippingMessage} role="status">
              {shippingMessage}
            </p>
          )}
        </section>
      )}

      <div className={styles.cartTotals}>
        <div>
          <span>Total de peças</span>
          <strong>{summary.totalPieces}</strong>
        </div>
        <div>
          <span>Subtotal</span>
          <strong className={styles.metricPulse} key={summary.subtotalInCents}>
            {formatCartPrice(summary.subtotalInCents)}
          </strong>
        </div>
        {selectedShipping && (
          <div>
            <span>Entrega ({selectedShipping.label})</span>
            <strong>{formatCartPrice(selectedShipping.priceInCents)}</strong>
          </div>
        )}
      </div>

      <div className={styles.cartGrandTotal} aria-live="polite">
        <span>TOTAL</span>
        <strong className={styles.metricPulse} key={estimatedTotal}>
          {formatCartPrice(estimatedTotal)}
        </strong>
        <small>Valor final do pedido</small>
      </div>

      <Button
        className={styles.finalizeButton}
        disabled={!summary.isEligible || isUpdating}
        onClick={onFinalize}
      >
        {summary.isEligible
          ? "Continuar pedido"
          : `Adicione mais ${summary.missingPieces} ${summary.missingPieces === 1 ? "peça" : "peças"}`}
        {summary.isEligible && (
          <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
        )}
      </Button>
      {finalizationNotice && summary.isEligible && (
        <p className={styles.finalizationNotice} role="status">
          {finalizationNotice}
        </p>
      )}
    </div>
  );
}
