import { Minus, Plus } from "lucide-react";

import styles from "./landing-commerce.module.css";

type QuantitySelectorProps = Readonly<{
  id: string;
  onChange: (quantity: number) => void;
  quantity: number;
}>;

export function QuantitySelector({
  id,
  onChange,
  quantity,
}: QuantitySelectorProps) {
  const labelId = `quantity-label-${id}`;

  return (
    <div className={styles.quantityField}>
      <span id={labelId}>Quantidade</span>
      <div className={styles.quantityControl} aria-labelledby={labelId}>
        <button
          type="button"
          aria-label="Diminuir quantidade"
          disabled={quantity === 1}
          onClick={() => onChange(Math.max(1, quantity - 1))}
        >
          <Minus aria-hidden="true" size={16} strokeWidth={2} />
        </button>
        <output aria-live="off">{quantity}</output>
        <button
          type="button"
          aria-label="Aumentar quantidade"
          onClick={() => onChange(quantity + 1)}
        >
          <Plus aria-hidden="true" size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
