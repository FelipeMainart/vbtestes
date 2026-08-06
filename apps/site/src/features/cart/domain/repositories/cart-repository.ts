import type { OrderLine } from "../entities/order-line";

export type CartRepositoryLoadResult =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{
      lines: readonly OrderLine[];
      status: "loaded";
    }>;

export interface CartRepository {
  load(): Promise<CartRepositoryLoadResult>;
  save(lines: readonly OrderLine[]): Promise<void>;
}
