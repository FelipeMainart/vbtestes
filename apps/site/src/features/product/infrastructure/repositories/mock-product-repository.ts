import { ORDER_BUILDER_PRODUCTS_MOCK } from "@/mocks/product/order-builder-products";

import type { ProductRepository } from "../../domain/repositories/product-repository";
import { orderBuilderProductsSchema } from "../schemas/order-builder-products.schema";

export class MockProductRepository implements ProductRepository {
  async getProducts() {
    return orderBuilderProductsSchema.parse(ORDER_BUILDER_PRODUCTS_MOCK);
  }

  async getProductByReference(reference: string) {
    const products = await this.getProducts();

    return products.find((product) => product.reference === reference) ?? null;
  }
}
