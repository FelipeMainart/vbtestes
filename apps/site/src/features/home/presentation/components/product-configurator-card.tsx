"use client";

import { useState } from "react";

import { Check, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CartAddResult } from "@/features/cart";
import type { OrderBuilderProduct } from "@/features/product";

import { formatHomePrice } from "../utils/format-home-price";
import { ColorSelector } from "./color-selector";
import styles from "./landing-commerce.module.css";
import { ProductVisual } from "./product-visual";
import { QuantitySelector } from "./quantity-selector";
import { SizeSelector } from "./size-selector";

type ProductConfiguratorCardProps = Readonly<{
  isCartUpdating: boolean;
  onAdd: (
    product: OrderBuilderProduct,
    colorId: string | null,
    sizeId: string | null,
    quantity: number,
  ) => Promise<CartAddResult>;
  product: OrderBuilderProduct;
}>;

const errorMessages = {
  "color-required": "Escolha uma cor.",
  "invalid-quantity": "Informe uma quantidade inteira maior que zero.",
  "size-required": "Escolha um tamanho.",
  "variation-unavailable":
    "Essa combinação não está disponível. Escolha outra cor ou tamanho.",
} as const;

export function ProductConfiguratorCard({
  isCartUpdating,
  onAdd,
  product,
}: ProductConfiguratorCardProps) {
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const selectedColor = product.colors.find(
    (color) => color.id === selectedColorId,
  );
  const availableSizeIds = product.variations
    .filter(
      (variation) =>
        variation.colorId === selectedColorId && variation.available,
    )
    .map((variation) => variation.sizeId);
  const isSelectionComplete = Boolean(selectedColorId && selectedSizeId);

  function handleColorChange(colorId: string) {
    const sizeStillAvailable = product.variations.some(
      (variation) =>
        variation.colorId === colorId &&
        variation.sizeId === selectedSizeId &&
        variation.available,
    );

    setSelectedColorId(colorId);
    setErrorMessage(null);
    setIsAdded(false);
    if (selectedSizeId && !sizeStillAvailable) {
      setSelectedSizeId(null);
    }
  }

  async function handleAdd() {
    setIsAdded(false);
    setIsAdding(true);
    const result = await onAdd(
      product,
      selectedColorId,
      selectedSizeId,
      quantity,
    );

    setErrorMessage(result.ok ? null : errorMessages[result.error]);
    setIsAdded(result.ok);
    setIsAdding(false);
  }

  return (
    <article className={`ds-card ${styles.productCard}`}>
      <ProductVisual
        key={selectedColor?.imageUrl ?? product.defaultImageUrl}
        alt={selectedColor?.imageAlt ?? product.defaultImageAlt}
        imageUrl={selectedColor?.imageUrl ?? product.defaultImageUrl}
        tone={selectedColor?.tone ?? null}
      />

      <div className={styles.productContent}>
        <div className={styles.productHeading}>
          <div>
            <p className={styles.productReference}>{product.reference}</p>
            <h3>{product.name}</h3>
          </div>
          <p className={styles.productPrice}>
            {formatHomePrice(product.priceInCents)}
            <span> / peça</span>
          </p>
        </div>
        <p className={styles.productDescription}>{product.description}</p>
        <div className={styles.configuratorFields}>
          <ColorSelector
            groupName={`color-${product.id}`}
            onChange={handleColorChange}
            options={product.colors}
            selectedColorId={selectedColorId}
          />
          <div>
            <SizeSelector
              availableSizeIds={availableSizeIds}
              groupName={`size-${product.id}`}
              onChange={(sizeId) => {
                setSelectedSizeId(sizeId);
                setErrorMessage(null);
                setIsAdded(false);
              }}
              options={product.sizes}
              selectedSizeId={selectedSizeId}
            />
            {!selectedColorId && (
              <p className={styles.fieldHint}>Escolha uma cor primeiro.</p>
            )}
          </div>
          <QuantitySelector
            id={product.id}
            onChange={(nextQuantity) => {
              setQuantity(nextQuantity);
              setIsAdded(false);
            }}
            quantity={quantity}
          />
        </div>

        <Button
          className={styles.addButton}
          disabled={!isSelectionComplete || isAdding || isCartUpdating}
          onClick={handleAdd}
        >
          {isAdded ? (
            <Check aria-hidden="true" size={18} strokeWidth={2.2} />
          ) : (
            <ShoppingBag aria-hidden="true" size={18} strokeWidth={2} />
          )}
          {isAdding
            ? "Adicionando…"
            : isAdded
              ? "Adicionado"
              : "Adicionar ao pedido"}
        </Button>
        {errorMessage && (
          <p className={styles.selectionError} role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </article>
  );
}
