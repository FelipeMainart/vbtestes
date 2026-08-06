import type { CartOperationResult } from "../dto/cart-operation-result";
import type { OrderLine } from "../../domain/entities/order-line";
import { summarizeOrder } from "./add-item-to-order";

export function removeOrderLine(
  currentLines: readonly OrderLine[],
  variationId: string,
): CartOperationResult {
  if (!currentLines.some((line) => line.variationId === variationId)) {
    return { error: "line-not-found", ok: false };
  }

  const lines = currentLines.filter((line) => line.variationId !== variationId);

  return { lines, ok: true, summary: summarizeOrder(lines) };
}
