import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { SiteProductColor } from "../../domain/entities/site-product-color";
import type { SiteProductColorRepository } from "../../domain/repositories/site-product-color-repository";
import { siteProductColorRowSchema } from "../schemas/site-product-color.schema";

export class SupabaseSiteProductColorRepository
  implements SiteProductColorRepository
{
  async getByProductId(productId: string) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("product_colors")
      .select("id,product_id,color_name,image_url,active")
      .eq("product_id", productId)
      .eq("active", true)
      .order("color_name", { ascending: true });

    if (error) {
      throw new Error(`Unable to load product colors: ${error.message}`);
    }

    return z
      .array(siteProductColorRowSchema)
      .parse(data)
      .map<SiteProductColor>((row) => ({
        active: row.active,
        id: row.id,
        imageUrl: row.image_url,
        name: row.color_name,
        productId: row.product_id,
      }));
  }
}
