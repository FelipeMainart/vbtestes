import { restoreOrder } from "@/features/cart/application/use-cases/restore-order";
import { summarizeOrder } from "@/features/cart";
import type { OrderLine } from "@/features/cart";
import type { ProductRepository } from "@/features/product/domain/repositories/product-repository";

export async function prepareCheckout(
  lines: readonly OrderLine[],
  productRepository: ProductRepository,
) {
  const products = await productRepository.getProducts();
  const restored = restoreOrder(lines, products);
  const summary = summarizeOrder(restored.lines);

  if (restored.discardedLines > 0 || !summary.isEligible) {
    return { ok: false as const, reason: "minimum-or-invalid" as const };
  }

  return {
    ok: true as const,
    snapshot: { lines: restored.lines, summary },
  };
}
