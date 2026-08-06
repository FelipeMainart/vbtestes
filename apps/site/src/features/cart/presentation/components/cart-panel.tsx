"use client";

import { useCallback, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import type { ShippingOption } from "@/services/interfaces/shipping-service";
import type { OrderLine, OrderSummary } from "../../domain/entities/order-line";
import { formatCartPrice } from "../utils/format-cart-price";
import { CartSummaryContent } from "./cart-summary-content";
import styles from "./cart-panel.module.css";

type CartPanelProps = Readonly<{
  isUpdating: boolean;
  lines: readonly OrderLine[];
  onDecrement: (variationId: string) => void;
  onCalculateShipping: (
    postalCode: string,
  ) => Promise<readonly ShippingOption[]>;
  onFinalize: (selection: ShippingSelection | null) => void;
  onIncrement: (variationId: string) => void;
  onRemove: (variationId: string) => void;
  summary: OrderSummary;
}>;

export type ShippingSelection = Readonly<{
  option: ShippingOption;
  postalCode: string;
}>;

export function CartPanel({
  isUpdating,
  lines,
  onCalculateShipping,
  onDecrement,
  onFinalize,
  onIncrement,
  onRemove,
  summary,
}: CartPanelProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [shippingOptions, setShippingOptions] = useState<
    readonly ShippingOption[]
  >([]);
  const [shippingId, setShippingId] = useState<ShippingOption["id"] | null>(
    null,
  );
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingMessage, setShippingMessage] = useState<string | null>(null);
  const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const selectedShipping = shippingOptions.find(
    (option) => option.id === shippingId,
  );
  const selection = selectedShipping
    ? { option: selectedShipping, postalCode }
    : null;

  async function handleCalculateShipping() {
    if (postalCode.replace(/\D/g, "").length !== 8) {
      setShippingMessage("Informe um CEP com 8 dígitos.");
      return;
    }
    setIsCalculatingShipping(true);
    setShippingMessage(null);
    const options = await onCalculateShipping(postalCode);
    setShippingOptions(options);
    setShippingId(null);
    setShippingMessage(
      options.length
        ? "Escolha uma opção de entrega."
        : "Nenhuma opção encontrada para este CEP.",
    );
    setIsCalculatingShipping(false);
  }

  const sharedContentProps = {
    finalizationNotice: null,
    isUpdating,
    lines,
    onDecrement,
    isCalculatingShipping,
    onCalculateShipping: handleCalculateShipping,
    onFinalize: () => onFinalize(selection),
    onIncrement,
    onRemove,
    onShippingChange: setShippingId,
    onPostalCodeChange: setPostalCode,
    postalCode,
    selectedShippingId: shippingId,
    shippingMessage,
    shippingOptions,
    summary,
  };

  return (
    <>
      <aside className={styles.cartSidebar} aria-label="Resumo do pedido">
        <CartSummaryContent
          {...sharedContentProps}
          showHeading
          surface="light"
        />
      </aside>
      <div className={styles.mobileCartBar} aria-label="Resumo do pedido">
        <progress
          aria-label="Progresso do pedido mínimo"
          className={styles.mobileProgress}
          max={summary.minimumPieces}
          value={Math.min(summary.totalPieces, summary.minimumPieces)}
        />
        <div className={styles.mobileCartSummary}>
          <strong>
            {summary.totalPieces} de {summary.minimumPieces} peças
          </strong>
          <span>
            {summary.missingPieces > 0
              ? `Faltam ${summary.missingPieces}`
              : "Mínimo atingido"}
          </span>
        </div>
        <strong className={styles.mobileCartSubtotal}>
          {formatCartPrice(summary.subtotalInCents)}
        </strong>
        <button
          aria-expanded={isDrawerOpen}
          aria-haspopup="dialog"
          className="ds-button ds-button--secondary"
          onClick={() => setIsDrawerOpen(true)}
          type="button"
        >
          Ver Pedido
        </button>
      </div>
      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        placement="bottom"
        title="Seu Pedido"
      >
        <div className={styles.cartDrawerBody}>
          <CartSummaryContent
            {...sharedContentProps}
            showHeading={false}
            surface="light"
          />
        </div>
      </Drawer>
    </>
  );
}
