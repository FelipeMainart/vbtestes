import { z } from "zod";

export const siteProductColorRowSchema = z.object({
  active: z.boolean(),
  color_name: z.string().min(1),
  id: z.string().min(1),
  image_url: z.url().nullable(),
  product_id: z.string().min(1),
});
