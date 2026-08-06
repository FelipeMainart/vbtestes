import type { SiteProductColor } from "../entities/site-product-color";

export interface SiteProductColorRepository {
  getByProductId(productId: string): Promise<readonly SiteProductColor[]>;
}
