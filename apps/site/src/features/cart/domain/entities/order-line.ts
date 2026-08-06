export type OrderLine = Readonly<{
  colorId: string;
  colorLabel: string;
  imageAlt: string;
  imageUrl: string;
  name: string;
  priceInCents: number;
  productId: string;
  quantity: number;
  reference: string;
  sizeId: string;
  sizeLabel: string;
  variationId: string;
}>;

export type OrderSummary = Readonly<{
  isEligible: boolean;
  minimumPieces: number;
  missingPieces: number;
  progressState: "empty" | "below-minimum" | "one-remaining" | "eligible";
  subtotalInCents: number;
  totalPieces: number;
}>;
