import type {
  SiteProductDisplaySettingsInput,
  SiteProductSeoInput,
  SiteProductSettings,
  UpdateSiteProductSettingsInput,
} from "../entities/site-product-settings";

export interface SiteProductSettingsRepository {
  getByProductId(productId: string): Promise<SiteProductSettings | null>;
  publish(productId: string): Promise<SiteProductSettings>;
  unpublish(productId: string): Promise<SiteProductSettings>;
  updateSeo(
    productId: string,
    input: SiteProductSeoInput,
  ): Promise<SiteProductSettings>;
  updateDisplaySettings(
    productId: string,
    input: SiteProductDisplaySettingsInput,
  ): Promise<SiteProductSettings>;
  updateSettings(
    productId: string,
    input: UpdateSiteProductSettingsInput,
  ): Promise<SiteProductSettings>;
}
