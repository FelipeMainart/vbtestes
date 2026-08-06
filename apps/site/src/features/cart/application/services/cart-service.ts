import type { AddItemToOrderError } from "../use-cases/add-item-to-order";
import type { AddItemToOrderInput } from "../use-cases/add-item-to-order";
import type { CartOperationError } from "../dto/cart-operation-result";
import type { OrderableProduct } from "../dto/orderable-product";
import type { OrderLine, OrderSummary } from "../../domain/entities/order-line";

export type CartPersistenceStatus = "saved" | "failed";

export type CartAddResult =
  | Readonly<{
      error: AddItemToOrderError;
      ok: false;
    }>
  | Readonly<{
      addedLine: OrderLine;
      lines: readonly OrderLine[];
      ok: true;
      persistence: CartPersistenceStatus;
      summary: OrderSummary;
    }>;

export type CartEditResult =
  | Readonly<{
      error: CartOperationError;
      ok: false;
    }>
  | Readonly<{
      lines: readonly OrderLine[];
      ok: true;
      persistence: CartPersistenceStatus;
      summary: OrderSummary;
    }>;

export type CartLoadStatus =
  "empty" | "invalid" | "loaded" | "recovered" | "unavailable";

export type CartLoadResult = Readonly<{
  lines: readonly OrderLine[];
  persistence: CartPersistenceStatus;
  status: CartLoadStatus;
  summary: OrderSummary;
}>;

export interface CartService {
  add(
    currentLines: readonly OrderLine[],
    input: AddItemToOrderInput,
  ): Promise<CartAddResult>;
  clear(): Promise<CartEditResult>;
  decrement(
    currentLines: readonly OrderLine[],
    variationId: string,
  ): Promise<CartEditResult>;
  increment(
    currentLines: readonly OrderLine[],
    variationId: string,
  ): Promise<CartEditResult>;
  load(products: readonly OrderableProduct[]): Promise<CartLoadResult>;
  remove(
    currentLines: readonly OrderLine[],
    variationId: string,
  ): Promise<CartEditResult>;
}
