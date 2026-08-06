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

const orderSummarySchema = z.object({
  isEligible: z.boolean(),
  minimumPieces: z.number().int().positive(),
  missingPieces: z.number().int().nonnegative(),
  progressState: z.enum([
    "empty",
    "below-minimum",
    "one-remaining",
    "eligible",
  ]),
  subtotalInCents: z.number().int().nonnegative(),
  totalPieces: z.number().int().nonnegative(),
});

export const localOrderSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  number: z.string().min(1),
  review: z.object({
    address: z.object({
      city: z.string().min(1),
      complement: z.string().optional(),
      neighborhood: z.string().min(1),
      number: z.string().min(1),
      postalCode: z.string().min(1),
      state: z.string().min(1),
      street: z.string().min(1),
    }),
    customer: z.object({
      cpf: z.string().optional(),
      email: z.email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().min(1),
    }),
    payment: z.object({
      description: z.string(),
      id: z.enum(["pix", "card", "boleto"]),
      label: z.string().min(1),
    }),
    shipping: z.object({
      deliveryEstimate: z.string().min(1),
      id: z.enum(["pac", "sedex", "premium"]),
      label: z.string().min(1),
      priceInCents: z.number().int().nonnegative(),
    }),
    snapshot: z.object({
      lines: z.array(orderLineSchema).min(1),
      summary: orderSummarySchema,
    }),
    totalInCents: z.number().int().nonnegative(),
  }),
  status: z.literal("mock-confirmed"),
});

export const localOrdersSchema = z.object({
  orders: z.array(localOrderSchema).max(5),
  version: z.literal(1),
});
