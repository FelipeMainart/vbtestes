import type { OrderLine } from "@/features/cart";
import type { AddressLookup } from "@/services/interfaces/address-service";
import type { PaymentOption } from "@/services/interfaces/payment-service";
import type { ShippingOption } from "@/services/interfaces/shipping-service";

import type {
  CheckoutAddress,
  CheckoutCustomer,
  CheckoutReview,
  CheckoutSnapshot,
} from "../../domain/entities/checkout";

export interface CheckoutService {
  calculateShipping(postalCode: string): Promise<readonly ShippingOption[]>;
  getPaymentOptions(): Promise<readonly PaymentOption[]>;
  lookupAddress(postalCode: string): Promise<AddressLookup | null>;
  prepare(
    lines: readonly OrderLine[],
  ): Promise<
    | Readonly<{ ok: false; reason: "minimum-or-invalid" }>
    | Readonly<{ ok: true; snapshot: CheckoutSnapshot }>
  >;
  review(input: {
    address: CheckoutAddress;
    customer: CheckoutCustomer;
    lines: readonly OrderLine[];
    paymentId: PaymentOption["id"];
    shippingId: ShippingOption["id"];
  }): Promise<
    | Readonly<{ ok: false; reason: "invalid-checkout" }>
    | Readonly<{ ok: true; review: CheckoutReview }>
  >;
}
