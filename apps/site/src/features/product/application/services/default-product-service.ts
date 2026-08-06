import type { ProductRepository } from "../../domain/repositories/product-repository";
import type { ProductService } from "./product-service";

export class DefaultProductService implements ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  listOrderBuilderProducts() {
    return this.productRepository.listActive();
  }
}
