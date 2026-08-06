import type {
  CartRepository,
  CartRepositoryLoadResult,
} from "../../domain/repositories/cart-repository";
import type { OrderLine } from "../../domain/entities/order-line";
import { localCartSchema } from "../schemas/local-cart.schema";

const storageKey = "veste-bem:cart";

export class LocalCartRepository implements CartRepository {
  async load(): Promise<CartRepositoryLoadResult> {
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      return { status: "empty" };
    }

    try {
      const parsedValue: unknown = JSON.parse(storedValue);
      const result = localCartSchema.safeParse(parsedValue);

      if (!result.success) {
        return { status: "invalid" };
      }

      return { lines: result.data.lines, status: "loaded" };
    } catch {
      return { status: "invalid" };
    }
  }

  async save(lines: readonly OrderLine[]): Promise<void> {
    const snapshot = localCartSchema.parse({ lines, version: 1 });
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }
}
