import { z } from "zod";

const orderLineSchema = z.object({
  colorId: z.string().min(1),
  colorLabel: z.string().min(1),
  imageAlt: z.string().min(1),
  imageUrl: z.url(),
  name: z.string().min(1),
  priceInCents: z.number().int().nonnegative(),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  reference: z.string().min(1),
  sizeId: z.string().min(1),
  sizeLabel: z.string().min(1),
  variationId: z.string().min(1),
});

export const localCartSchema = z.object({
  lines: z.array(orderLineSchema),
  version: z.literal(1),
});
