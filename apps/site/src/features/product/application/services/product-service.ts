import type { OrderBuilderProduct } from "../../domain/entities/order-builder-product";

export interface ProductService {
  listOrderBuilderProducts(): Promise<readonly OrderBuilderProduct[]>;
}
