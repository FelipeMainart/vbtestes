export type ProductColorTone =
  "black" | "off-white" | "beige" | "navy" | "gray";

export type ProductColor = Readonly<{
  id: string;
  imageAlt: string;
  imageUrl: string;
  label: string;
  tone: ProductColorTone;
}>;

export type ProductSize = Readonly<{
  id: string;
  label: string;
}>;

export type ProductVariation = Readonly<{
  available: boolean;
  colorId: string;
  id: string;
  sizeId: string;
}>;

export type OrderBuilderProduct = Readonly<{
  colors: readonly ProductColor[];
  defaultImageAlt: string;
  defaultImageUrl: string;
  description: string;
  id: string;
  name: string;
  priceInCents: number;
  reference: string;
  sizes: readonly ProductSize[];
  status: "active";
  variations: readonly ProductVariation[];
}>;
