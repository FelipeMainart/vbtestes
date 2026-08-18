import type { Metadata } from "next";

import { CheckoutPage } from "@/features/checkout/presentation/components/checkout-page";
import { createCheckoutService } from "@/lib/composition/checkout";
import { createStorefrontProductService } from "@/lib/composition/product";

export const metadata: Metadata = { title: "Checkout" };

export default async function Page() {
  const [paymentOptions, products] = await Promise.all([
    createCheckoutService().getPaymentOptions(),
    createStorefrontProductService().getProducts(),
  ]);
  return <CheckoutPage paymentOptions={paymentOptions} products={products} />;
}
