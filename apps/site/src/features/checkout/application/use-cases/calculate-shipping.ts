import type { ShippingService } from "@/services/interfaces/shipping-service";

export function calculateShipping(
  postalCode: string,
  service: ShippingService,
) {
  return service.calculate(postalCode);
}
