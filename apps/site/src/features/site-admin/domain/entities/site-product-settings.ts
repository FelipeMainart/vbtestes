export type SiteProductSettings = Readonly<{
  createdAt: string;
  isFeatured: boolean;
  isPublished: boolean;
  productId: string;
  publishedAt: string | null;
  seoDescription: string | null;
  seoTitle: string | null;
  updatedAt: string;
}>;

export type SiteProductSeoInput = Readonly<{
  description: string | null;
  title: string | null;
}>;

export type SiteProductDisplaySettingsInput = Readonly<{
  isFeatured: boolean;
}>;

export type UpdateSiteProductSettingsInput = Readonly<{
  isFeatured: boolean;
  isPublished: boolean;
  seoDescription: string | null;
  seoTitle: string | null;
}>;
