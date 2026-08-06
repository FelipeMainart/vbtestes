import type { ProductRepository } from "@/features/product/domain/repositories/product-repository";
import type { PaymentService } from "@/services/interfaces/payment-service";
import type { ShippingService } from "@/services/interfaces/shipping-service";

import { addressSchema, customerSchema } from "../schemas/checkout.schema";
import type { CheckoutService } from "../services/checkout-service";
import { calculateShipping } from "./calculate-shipping";
import { listPaymentOptions } from "./list-payment-options";
import { prepareCheckout } from "./prepare-checkout";

export async function reviewCheckout(
  input: Parameters<CheckoutService["review"]>[0],
  dependencies: Readonly<{
    paymentService: PaymentService;
    productRepository: ProductRepository;
    shippingService: ShippingService;
  }>,
) {
  const [prepared, shippingOptions, paymentOptions] = await Promise.all([
    prepareCheckout(input.lines, dependencies.productRepository),
    calculateShipping(input.address.postalCode, dependencies.shippingService),
    listPaymentOptions(dependencies.paymentService),
  ]);
  const address = addressSchema.safeParse(input.address);
  const customer = customerSchema.safeParse(input.customer);
  const shipping = shippingOptions.find((item) => item.id === input.shippingId);
  const payment = paymentOptions.find((item) => item.id === input.paymentId);

  if (
    !prepared.ok ||
    !address.success ||
    !customer.success ||
    !shipping ||
    !payment
  ) {
    return { ok: false as const, reason: "invalid-checkout" as const };
  }

  return {
    ok: true as const,
    review: {
      address: address.data,
      customer: customer.data,
      payment,
      shipping,
      snapshot: prepared.snapshot,
      totalInCents:
        prepared.snapshot.summary.subtotalInCents + shipping.priceInCents,
    },
  };
}
