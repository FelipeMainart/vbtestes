import type { CartRepository } from "../../domain/repositories/cart-repository";
import type { OrderLine } from "../../domain/entities/order-line";
import type { OrderableProduct } from "../dto/orderable-product";
import {
  addItemToOrder,
  summarizeOrder,
  type AddItemToOrderInput,
} from "../use-cases/add-item-to-order";
import { changeOrderLineQuantity } from "../use-cases/change-order-line-quantity";
import { removeOrderLine } from "../use-cases/remove-order-line";
import { restoreOrder } from "../use-cases/restore-order";
import type {
  CartAddResult,
  CartEditResult,
  CartLoadResult,
  CartPersistenceStatus,
  CartService,
} from "./cart-service";

export class DefaultCartService implements CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  async load(products: readonly OrderableProduct[]): Promise<CartLoadResult> {
    try {
      const storedCart = await this.cartRepository.load();

      if (storedCart.status === "empty") {
        return this.createLoadResult([], "empty", "saved");
      }

      if (storedCart.status === "invalid") {
        const persistence = await this.persist([]);
        return this.createLoadResult([], "invalid", persistence);
      }

      const restoredCart = restoreOrder(storedCart.lines, products);
      const persistence = await this.persist(restoredCart.lines);

      return this.createLoadResult(
        restoredCart.lines,
        restoredCart.discardedLines > 0 ? "recovered" : "loaded",
        persistence,
      );
    } catch {
      return this.createLoadResult([], "unavailable", "failed");
    }
  }

  async add(
    currentLines: readonly OrderLine[],
    input: AddItemToOrderInput,
  ): Promise<CartAddResult> {
    const result = addItemToOrder(currentLines, input);

    if (!result.ok) {
      return result;
    }

    return {
      ...result,
      persistence: await this.persist(result.lines),
    };
  }

  async clear(): Promise<CartEditResult> {
    return {
      lines: [],
      ok: true,
      persistence: await this.persist([]),
      summary: summarizeOrder([]),
    };
  }

  async increment(
    currentLines: readonly OrderLine[],
    variationId: string,
  ): Promise<CartEditResult> {
    const line = currentLines.find(
      (candidate) => candidate.variationId === variationId,
    );

    if (!line) {
      return { error: "line-not-found", ok: false };
    }

    return this.changeQuantity(currentLines, variationId, line.quantity + 1);
  }

  async decrement(
    currentLines: readonly OrderLine[],
    variationId: string,
  ): Promise<CartEditResult> {
    const line = currentLines.find(
      (candidate) => candidate.variationId === variationId,
    );

    if (!line) {
      return { error: "line-not-found", ok: false };
    }

    return this.changeQuantity(currentLines, variationId, line.quantity - 1);
  }

  async remove(
    currentLines: readonly OrderLine[],
    variationId: string,
  ): Promise<CartEditResult> {
    const result = removeOrderLine(currentLines, variationId);

    if (!result.ok) {
      return result;
    }

    return {
      ...result,
      persistence: await this.persist(result.lines),
    };
  }

  private async changeQuantity(
    currentLines: readonly OrderLine[],
    variationId: string,
    nextQuantity: number,
  ): Promise<CartEditResult> {
    const result = changeOrderLineQuantity(
      currentLines,
      variationId,
      nextQuantity,
    );

    if (!result.ok) {
      return result;
    }

    return {
      ...result,
      persistence: await this.persist(result.lines),
    };
  }

  private createLoadResult(
    lines: readonly OrderLine[],
    status: CartLoadResult["status"],
    persistence: CartPersistenceStatus,
  ): CartLoadResult {
    return { lines, persistence, status, summary: summarizeOrder(lines) };
  }

  private async persist(
    lines: readonly OrderLine[],
  ): Promise<CartPersistenceStatus> {
    try {
      await this.cartRepository.save(lines);
      return "saved";
    } catch {
      return "failed";
    }
  }
}
