import type { OrderBuilderProduct } from "../entities/order-builder-product";

export interface ProductRepository {
  getProducts(): Promise<readonly OrderBuilderProduct[]>;
  getProductByReference(
    reference: string,
  ): Promise<OrderBuilderProduct | null>;
}
