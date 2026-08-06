import { z } from "zod";

const colorSchema = z.object({
  id: z.string().min(1),
  imageAlt: z.string().min(1),
  imageUrl: z.url(),
  label: z.string().min(1),
  tone: z.enum(["black", "off-white", "beige", "navy", "gray"]),
});

const sizeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const variationSchema = z.object({
  available: z.boolean(),
  colorId: z.string().min(1),
  id: z.string().min(1),
  sizeId: z.string().min(1),
});

export const orderBuilderProductsSchema = z.array(
  z.object({
    colors: z.array(colorSchema),
    defaultImageAlt: z.string(),
    defaultImageUrl: z.union([z.url(), z.literal("")]),
    description: z.string(),
    id: z.string().min(1),
    name: z.string().min(1),
    priceInCents: z.number().int().nonnegative(),
    reference: z.string().min(1),
    sizes: z.array(sizeSchema),
    status: z.literal("active"),
    variations: z.array(variationSchema),
  }),
);
