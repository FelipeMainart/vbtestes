import { z } from "zod";

export const siteProductSettingsRowSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  is_featured: z.boolean(),
  is_published: z.boolean(),
  product_id: z.string().min(1),
  published_at: z.iso.datetime({ offset: true }).nullable(),
  seo_description: z.string().nullable(),
  seo_title: z.string().nullable(),
  updated_at: z.iso.datetime({ offset: true }),
});

export type SiteProductSettingsRow = z.infer<
  typeof siteProductSettingsRowSchema
>;
