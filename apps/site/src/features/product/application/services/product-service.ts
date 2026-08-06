import type { OrderBuilderProduct } from "../../domain/entities/order-builder-product";

export interface ProductService {
  getProducts(): Promise<readonly OrderBuilderProduct[]>;
  getProductByReference(
    reference: string,
  ): Promise<OrderBuilderProduct | null>;
}
