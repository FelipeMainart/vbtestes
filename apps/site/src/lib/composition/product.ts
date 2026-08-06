import "server-only";

import { DefaultProductService } from "@/features/product/application/services/default-product-service";
import type { ProductService } from "@/features/product/application/services/product-service";
import { SupabaseProductRepository } from "@/features/product/infrastructure/repositories/supabase-product-repository";

export function createProductService(): ProductService {
  return new DefaultProductService(new SupabaseProductRepository());
}
