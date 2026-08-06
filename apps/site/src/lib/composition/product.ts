import "server-only";

import { DefaultProductService } from "@/features/product/application/services/default-product-service";
import type { ProductService } from "@/features/product/application/services/product-service";
import { MockProductRepository } from "@/features/product/infrastructure/repositories/mock-product-repository";

export function createProductService(): ProductService {
  return new DefaultProductService(new MockProductRepository());
}
