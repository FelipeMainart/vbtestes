import type { ShippingService } from "@/services/interfaces/shipping-service";

const options = [
  {
    deliveryEstimate: "7 a 10 dias úteis",
    id: "pac",
    label: "PAC",
    priceInCents: 2490,
  },
  {
    deliveryEstimate: "3 a 5 dias úteis",
    id: "sedex",
    label: "SEDEX",
    priceInCents: 3990,
  },
  {
    deliveryEstimate: "2 a 4 dias úteis",
    id: "premium",
    label: "Transportadora Premium",
    priceInCents: 4990,
  },
] as const;

export class MockShippingService implements ShippingService {
  async calculate(postalCode: string) {
    if (postalCode.replace(/\D/g, "").length !== 8) return [];
    return options;
  }
}
