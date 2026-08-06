import type { ProductSize } from "@/features/product";

import styles from "./landing-commerce.module.css";

type SizeSelectorProps = Readonly<{
  availableSizeIds: readonly string[];
  groupName: string;
  onChange: (sizeId: string) => void;
  options: readonly ProductSize[];
  selectedSizeId: string | null;
}>;

export function SizeSelector({
  availableSizeIds,
  groupName,
  onChange,
  options,
  selectedSizeId,
}: SizeSelectorProps) {
  return (
    <fieldset className={styles.selectorFieldset}>
      <legend>Tamanho</legend>
      <div className={styles.sizeOptions}>
        {options.map((option) => {
          const isAvailable = availableSizeIds.includes(option.id);

          return (
            <label
              key={option.id}
              className={styles.sizeOption}
              data-selected={selectedSizeId === option.id}
            >
              <input
                checked={selectedSizeId === option.id}
                disabled={!isAvailable}
                name={groupName}
                onChange={() => onChange(option.id)}
                type="radio"
                value={option.id}
              />
              <span>{option.label}</span>
              {!isAvailable && (
                <span className={styles.visuallyHidden}>Indisponível</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
