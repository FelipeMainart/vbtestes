export type SiteProductMedia = Readonly<{
  altText: string;
  createdAt: string;
  height: number | null;
  id: string;
  imageUrl: string;
  isPrimary: boolean;
  mimeType: string | null;
  productColorId: string;
  sortOrder: number;
  storagePath: string;
  updatedAt: string;
  width: number | null;
}>;

export type CreateSiteProductMediaInput = Readonly<{
  altText?: string;
  height?: number | null;
  isPrimary?: boolean;
  mimeType?: string | null;
  productColorId: string;
  sortOrder?: number;
  storagePath: string;
  width?: number | null;
}>;
