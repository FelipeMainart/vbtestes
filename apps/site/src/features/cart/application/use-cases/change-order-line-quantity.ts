import type { CartOperationResult } from "../dto/cart-operation-result";
import type { OrderLine } from "../../domain/entities/order-line";
import { summarizeOrder } from "./add-item-to-order";

export function changeOrderLineQuantity(
  currentLines: readonly OrderLine[],
  variationId: string,
  nextQuantity: number,
): CartOperationResult {
  if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
    return { error: "invalid-quantity", ok: false };
  }

  if (!currentLines.some((line) => line.variationId === variationId)) {
    return { error: "line-not-found", ok: false };
  }

  const lines =
    nextQuantity === 0
      ? currentLines.filter((line) => line.variationId !== variationId)
      : currentLines.map((line) =>
          line.variationId === variationId
            ? { ...line, quantity: nextQuantity }
            : line,
        );

  return { lines, ok: true, summary: summarizeOrder(lines) };
}
