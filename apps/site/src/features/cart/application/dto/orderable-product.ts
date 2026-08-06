export type OrderableColor = Readonly<{
  id: string;
  imageAlt: string;
  imageUrl: string;
  label: string;
}>;

export type OrderableSize = Readonly<{
  id: string;
  label: string;
}>;

export type OrderableVariation = Readonly<{
  available: boolean;
  colorId: string;
  id: string;
  sizeId: string;
}>;

export type OrderableProduct = Readonly<{
  colors: readonly OrderableColor[];
  id: string;
  name: string;
  priceInCents: number;
  reference: string;
  sizes: readonly OrderableSize[];
  variations: readonly OrderableVariation[];
}>;
