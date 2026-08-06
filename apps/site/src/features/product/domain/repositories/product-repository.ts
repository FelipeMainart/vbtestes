import type { OrderBuilderProduct } from "../entities/order-builder-product";

export interface ProductRepository {
  listActive(): Promise<readonly OrderBuilderProduct[]>;
}
