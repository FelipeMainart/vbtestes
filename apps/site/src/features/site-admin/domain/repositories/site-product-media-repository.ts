import type {
  CreateSiteProductMediaInput,
  SiteProductMedia,
} from "../entities/site-product-media";

export interface SiteProductMediaRepository {
  getByColorId(colorId: string): Promise<readonly SiteProductMedia[]>;
  getPrimaryImage(colorId: string): Promise<SiteProductMedia | null>;
  uploadFile(storagePath: string, file: File): Promise<void>;
  create(input: CreateSiteProductMediaInput): Promise<SiteProductMedia>;
  remove(mediaId: string): Promise<void>;
  updateSortOrder(
    mediaId: string,
    sortOrder: number,
  ): Promise<SiteProductMedia>;
  setPrimary(mediaId: string): Promise<SiteProductMedia>;
}
