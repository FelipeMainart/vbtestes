import "server-only";

import type { CheckoutService } from "@/features/checkout/application/services/checkout-service";
import { MockCheckoutService } from "@/features/checkout/application/services/mock-checkout-service";
import { MockAddressService } from "@/features/checkout/infrastructure/services/mock-address-service";
import { MockPaymentService } from "@/features/checkout/infrastructure/services/mock-payment-service";
import { MockShippingService } from "@/features/checkout/infrastructure/services/mock-shipping-service";
import { MockProductRepository } from "@/features/product/infrastructure/repositories/mock-product-repository";

export function createCheckoutService(): CheckoutService {
  return new MockCheckoutService(
    new MockProductRepository(),
    new MockAddressService(),
    new MockShippingService(),
    new MockPaymentService(),
  );
}
