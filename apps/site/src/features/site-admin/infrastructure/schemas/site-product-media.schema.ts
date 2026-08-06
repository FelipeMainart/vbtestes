import { z } from "zod";

export const siteProductMediaRowSchema = z.object({
  alt_text: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  height: z.number().int().positive().nullable(),
  id: z.string().min(1),
  is_primary: z.boolean(),
  mime_type: z.string().nullable(),
  product_color_id: z.string().min(1),
  sort_order: z.number().int().nonnegative(),
  storage_path: z.string().min(1),
  updated_at: z.iso.datetime({ offset: true }),
  width: z.number().int().positive().nullable(),
});

export type SiteProductMediaRow = z.infer<typeof siteProductMediaRowSchema>;
