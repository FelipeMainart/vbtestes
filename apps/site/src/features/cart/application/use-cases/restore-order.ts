import type { OrderLine } from "../../domain/entities/order-line";
import type { OrderableProduct } from "../dto/orderable-product";
import { addItemToOrder } from "./add-item-to-order";

export type RestoreOrderResult = Readonly<{
  discardedLines: number;
  lines: readonly OrderLine[];
}>;

export function restoreOrder(
  storedLines: readonly OrderLine[],
  products: readonly OrderableProduct[],
): RestoreOrderResult {
  let lines: readonly OrderLine[] = [];
  let discardedLines = 0;

  for (const storedLine of storedLines) {
    const product = products.find(
      (candidate) => candidate.id === storedLine.productId,
    );

    if (!product) {
      discardedLines += 1;
      continue;
    }

    const result = addItemToOrder(lines, {
      colorId: storedLine.colorId,
      product,
      quantity: storedLine.quantity,
      sizeId: storedLine.sizeId,
    });

    if (!result.ok) {
      discardedLines += 1;
      continue;
    }

    lines = result.lines;
  }

  return { discardedLines, lines };
}
