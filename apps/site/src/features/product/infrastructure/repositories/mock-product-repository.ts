import { ORDER_BUILDER_PRODUCTS_MOCK } from "@/mocks/product/order-builder-products";

import type { ProductRepository } from "../../domain/repositories/product-repository";
import { orderBuilderProductsSchema } from "../schemas/order-builder-products.schema";

export class MockProductRepository implements ProductRepository {
  async listActive() {
    return orderBuilderProductsSchema.parse(ORDER_BUILDER_PRODUCTS_MOCK);
  }
}
