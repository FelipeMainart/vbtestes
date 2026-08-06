import { z } from "zod";

const actionSchema = z.object({
  href: z.string().startsWith("#"),
  label: z.string().min(1),
});

const titledItemSchema = z.object({
  description: z.string().min(1),
  id: z.string().min(1),
  title: z.string().min(1),
});

export const homeContentSchema = z.object({
  benefits: z.object({
    items: z.array(titledItemSchema),
    title: z.string().min(1),
  }),
  faq: z.object({
    items: z.array(
      z.object({
        answer: z.string().min(1),
        id: z.string().min(1),
        question: z.string().min(1),
      }),
    ),
    title: z.string().min(1),
  }),
  featuredProducts: z.object({
    description: z.string().min(1),
    eyebrow: z.string().min(1),
    title: z.string().min(1),
  }),
  hero: z.object({
    description: z.string().min(1),
    eyebrow: z.string().min(1),
    indicators: z.array(z.string().min(1)),
    mediaLabel: z.string().min(1),
    primaryAction: actionSchema,
    secondaryAction: actionSchema,
    title: z.string().min(1),
  }),
  howItWorks: z.object({
    steps: z.array(titledItemSchema),
    description: z.string().min(1),
    title: z.string().min(1),
  }),
});
