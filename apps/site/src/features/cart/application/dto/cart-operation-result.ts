import type { OrderLine, OrderSummary } from "../../domain/entities/order-line";

export type CartOperationError = "invalid-quantity" | "line-not-found";

export type CartOperationResult =
  | Readonly<{
      error: CartOperationError;
      ok: false;
    }>
  | Readonly<{
      lines: readonly OrderLine[];
      ok: true;
      summary: OrderSummary;
    }>;
