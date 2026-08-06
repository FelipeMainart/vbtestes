export type ShippingOption = Readonly<{
  deliveryEstimate: string;
  id: "pac" | "sedex" | "premium";
  label: string;
  priceInCents: number;
}>;

export interface ShippingService {
  calculate(postalCode: string): Promise<readonly ShippingOption[]>;
}
