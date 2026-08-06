import type { ProductColor, ProductColorTone } from "@/features/product";

import styles from "./landing-commerce.module.css";

type ColorSelectorProps = Readonly<{
  groupName: string;
  onChange: (colorId: string) => void;
  options: readonly ProductColor[];
  selectedColorId: string | null;
}>;

const toneClasses: Record<ProductColorTone, string> = {
  beige: styles.toneBeige,
  black: styles.toneBlack,
  gray: styles.toneGray,
  navy: styles.toneNavy,
  "off-white": styles.toneOffWhite,
};

export function ColorSelector({
  groupName,
  onChange,
  options,
  selectedColorId,
}: ColorSelectorProps) {
  return (
    <fieldset className={styles.selectorFieldset}>
      <legend>Cor</legend>
      <div className={styles.colorOptions}>
        {options.map((option) => (
          <label
            key={option.id}
            className={styles.colorOption}
            data-selected={selectedColorId === option.id}
          >
            <input
              checked={selectedColorId === option.id}
              name={groupName}
              onChange={() => onChange(option.id)}
              type="radio"
              value={option.id}
            />
            <span
              className={`${styles.colorSwatch} ${toneClasses[option.tone]}`}
              aria-hidden="true"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
