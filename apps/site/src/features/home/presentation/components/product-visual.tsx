import { useState } from "react";
import type { ReactNode } from "react";

import Image from "next/image";

import type { ProductColorTone } from "@/features/product";

import styles from "./landing-commerce.module.css";

type ProductVisualProps = Readonly<{
  alt: string;
  children?: ReactNode;
  imageUrl: string;
  tone: ProductColorTone | null;
}>;

const fallbackToneClasses: Record<ProductColorTone, string> = {
  beige: styles.fallbackBeige,
  black: styles.fallbackBlack,
  gray: styles.fallbackGray,
  navy: styles.fallbackNavy,
  "off-white": styles.fallbackOffWhite,
};

export function ProductVisual({
  alt,
  children,
  imageUrl,
  tone,
}: ProductVisualProps) {
  const [hasImageError, setHasImageError] = useState(false);

  return (
    <div className={styles.productVisual}>
      {!hasImageError ? (
        <Image
          alt={alt}
          className={styles.productImage}
          fill
          onError={() => setHasImageError(true)}
          sizes="(min-width: 64rem) 34rem, (min-width: 48rem) 40vw, 100vw"
          src={imageUrl}
        />
      ) : (
        <div
          className={`${styles.imageFallback} ${tone ? fallbackToneClasses[tone] : ""}`}
          role="img"
          aria-label={`${alt}. Imagem temporariamente indisponível.`}
        >
          <span>Imagem temporariamente indisponível</span>
        </div>
      )}
      {children}
    </div>
  );
}
