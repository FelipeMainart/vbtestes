"use server";

import { z } from "zod";

import {
  cartLineInputSchema,
  checkoutConfirmationSchema,
} from "../../application/schemas/checkout.schema";
import { createCheckoutService } from "@/lib/composition/checkout";
import { createOrderService } from "@/lib/composition/orders";

const postalCodeSchema = z.string().min(1).max(12);

export async function prepareCheckoutAction(input: unknown) {
  const parsed = z.array(cartLineInputSchema).safeParse(input);
  if (!parsed.success)
    return { ok: false as const, reason: "minimum-or-invalid" as const };
  return createCheckoutService().prepare(parsed.data);
}

export async function lookupAddressAction(input: unknown) {
  const parsed = postalCodeSchema.safeParse(input);
  if (!parsed.success) return null;
  return createCheckoutService().lookupAddress(parsed.data);
}

export async function calculateShippingAction(input: unknown) {
  const parsed = postalCodeSchema.safeParse(input);
  if (!parsed.success) return [];
  return createCheckoutService().calculateShipping(parsed.data);
}

export async function confirmOrderAction(input: unknown) {
  const parsed = checkoutConfirmationSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, reason: "invalid-checkout" as const };

  const service = createCheckoutService();
  const reviewed = await service.review(parsed.data);
  if (!reviewed.ok) return reviewed;

  const order = await createOrderService().create(
    reviewed.review,
    parsed.data.idempotencyKey,
  );
  return { ok: true as const, order, orderId: order.id };
}
