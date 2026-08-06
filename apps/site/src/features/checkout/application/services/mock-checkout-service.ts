import type { OrderLine } from "@/features/cart";
import type { ProductRepository } from "@/features/product/domain/repositories/product-repository";
import type { AddressService } from "@/services/interfaces/address-service";
import type { PaymentService } from "@/services/interfaces/payment-service";
import type { ShippingService } from "@/services/interfaces/shipping-service";

import { calculateShipping } from "../use-cases/calculate-shipping";
import { listPaymentOptions } from "../use-cases/list-payment-options";
import { lookupAddress } from "../use-cases/lookup-address";
import { prepareCheckout } from "../use-cases/prepare-checkout";
import { reviewCheckout } from "../use-cases/review-checkout";
import type { CheckoutService } from "./checkout-service";

export class MockCheckoutService implements CheckoutService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly addressService: AddressService,
    private readonly shippingService: ShippingService,
    private readonly paymentService: PaymentService,
  ) {}

  prepare(lines: readonly OrderLine[]) {
    return prepareCheckout(lines, this.productRepository);
  }

  lookupAddress(postalCode: string) {
    return lookupAddress(postalCode, this.addressService);
  }

  calculateShipping(postalCode: string) {
    return calculateShipping(postalCode, this.shippingService);
  }

  getPaymentOptions() {
    return listPaymentOptions(this.paymentService);
  }

  async review(input: Parameters<CheckoutService["review"]>[0]) {
    return reviewCheckout(input, {
      paymentService: this.paymentService,
      productRepository: this.productRepository,
      shippingService: this.shippingService,
    });
  }
}
