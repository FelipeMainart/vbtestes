import type { OrderLine, OrderSummary } from "../../domain/entities/order-line";
import type { OrderableProduct } from "../dto/orderable-product";

const minimumOrderQuantity = 6;

export type AddItemToOrderInput = Readonly<{
  colorId: string | null;
  product: OrderableProduct;
  quantity: number;
  sizeId: string | null;
}>;

export type AddItemToOrderError =
  | "color-required"
  | "size-required"
  | "invalid-quantity"
  | "variation-unavailable";

export type AddItemToOrderResult =
  | Readonly<{
      error: AddItemToOrderError;
      ok: false;
    }>
  | Readonly<{
      addedLine: OrderLine;
      lines: readonly OrderLine[];
      ok: true;
      summary: OrderSummary;
    }>;

export function summarizeOrder(lines: readonly OrderLine[]): OrderSummary {
  const totals = lines.reduce(
    (summary, line) => ({
      subtotalInCents:
        summary.subtotalInCents + line.priceInCents * line.quantity,
      totalPieces: summary.totalPieces + line.quantity,
    }),
    { subtotalInCents: 0, totalPieces: 0 },
  );

  const missingPieces = Math.max(0, minimumOrderQuantity - totals.totalPieces);
  const progressState =
    totals.totalPieces === 0
      ? "empty"
      : totals.totalPieces >= minimumOrderQuantity
        ? "eligible"
        : missingPieces === 1
          ? "one-remaining"
          : "below-minimum";

  return {
    ...totals,
    isEligible: totals.totalPieces >= minimumOrderQuantity,
    minimumPieces: minimumOrderQuantity,
    missingPieces,
    progressState,
  };
}

export function addItemToOrder(
  currentLines: readonly OrderLine[],
  input: AddItemToOrderInput,
): AddItemToOrderResult {
  if (!input.colorId) {
    return { error: "color-required", ok: false };
  }

  if (!input.sizeId) {
    return { error: "size-required", ok: false };
  }

  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return { error: "invalid-quantity", ok: false };
  }

  const variation = input.product.variations.find(
    (candidate) =>
      candidate.colorId === input.colorId &&
      candidate.sizeId === input.sizeId &&
      candidate.available,
  );
  const color = input.product.colors.find(
    (candidate) => candidate.id === input.colorId,
  );
  const size = input.product.sizes.find(
    (candidate) => candidate.id === input.sizeId,
  );

  if (!variation || !color || !size) {
    return { error: "variation-unavailable", ok: false };
  }

  const addedLine: OrderLine = {
    colorId: color.id,
    colorLabel: color.label,
    imageAlt: color.imageAlt,
    imageUrl: color.imageUrl,
    name: input.product.name,
    priceInCents: input.product.priceInCents,
    productId: input.product.id,
    quantity: input.quantity,
    reference: input.product.reference,
    sizeId: size.id,
    sizeLabel: size.label,
    variationId: variation.id,
  };
  const existingLine = currentLines.find(
    (line) => line.variationId === variation.id,
  );
  const lines = existingLine
    ? currentLines.map((line) =>
        line.variationId === variation.id
          ? { ...line, quantity: line.quantity + input.quantity }
          : line,
      )
    : [...currentLines, addedLine];

  return {
    addedLine,
    lines,
    ok: true,
    summary: summarizeOrder(lines),
  };
}
