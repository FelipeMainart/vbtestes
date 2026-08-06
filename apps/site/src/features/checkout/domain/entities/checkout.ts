import type { OrderLine, OrderSummary } from "@/features/cart";
import type { PaymentOption } from "@/services/interfaces/payment-service";
import type { ShippingOption } from "@/services/interfaces/shipping-service";

export type CheckoutCustomer = Readonly<{
  cpf?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}>;

export type CheckoutAddress = Readonly<{
  city: string;
  complement?: string;
  neighborhood: string;
  number: string;
  postalCode: string;
  state: string;
  street: string;
}>;

export type CheckoutSnapshot = Readonly<{
  lines: readonly OrderLine[];
  summary: OrderSummary;
}>;

export type CheckoutReview = Readonly<{
  address: CheckoutAddress;
  customer: CheckoutCustomer;
  payment: PaymentOption;
  shipping: ShippingOption;
  snapshot: CheckoutSnapshot;
  totalInCents: number;
}>;
