import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";

import type { OrderLine } from "../../domain/entities/order-line";
import { formatCartPrice } from "../utils/format-cart-price";
import styles from "./cart-panel.module.css";

type CartLineItemProps = Readonly<{
  isUpdating: boolean;
  line: OrderLine;
  onDecrement: (variationId: string) => void;
  onIncrement: (variationId: string) => void;
  onRemove: (variationId: string) => void;
}>;

export function CartLineItem({
  isUpdating,
  line,
  onDecrement,
  onIncrement,
  onRemove,
}: CartLineItemProps) {
  return (
    <li className={styles.cartLine}>
      <Image
        alt={line.imageAlt}
        className={styles.lineImage}
        height={104}
        src={line.imageUrl}
        width={78}
      />
      <div className={styles.lineContent}>
        <div className={styles.lineHeading}>
          <div>
            <span className={styles.lineReference}>{line.reference}</span>
            <h4>{line.name}</h4>
          </div>
          <button
            aria-label={`Remover ${line.name}, ${line.colorLabel}, tamanho ${line.sizeLabel}`}
            className={styles.removeLineButton}
            disabled={isUpdating}
            onClick={() => onRemove(line.variationId)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </div>

        <p className={styles.lineVariation}>
          {line.colorLabel} · Tamanho {line.sizeLabel}
        </p>

        <div className={styles.linePrices}>
          <span>{formatCartPrice(line.priceInCents)} por peça</span>
          <strong>{formatCartPrice(line.priceInCents * line.quantity)}</strong>
        </div>

        <div className={styles.lineQuantity}>
          <span>Quantidade</span>
          <div>
            <button
              aria-label={`Diminuir quantidade de ${line.name}`}
              disabled={isUpdating}
              onClick={() => onDecrement(line.variationId)}
              type="button"
            >
              <Minus aria-hidden="true" size={16} strokeWidth={2} />
            </button>
            <output aria-label={`Quantidade de ${line.name}`}>
              {line.quantity}
            </output>
            <button
              aria-label={`Aumentar quantidade de ${line.name}`}
              disabled={isUpdating}
              onClick={() => onIncrement(line.variationId)}
              type="button"
            >
              <Plus aria-hidden="true" size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
