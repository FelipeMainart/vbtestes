import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { OrderBuilderProduct } from "../../domain/entities/order-builder-product";
import type { ProductRepository } from "../../domain/repositories/product-repository";
import { orderBuilderProductsSchema } from "../schemas/order-builder-products.schema";

const supabaseProductSchema = z.object({
  description: z.string().nullable(),
  id: z.string().min(1),
  image_url: z.url().nullable(),
  name: z.string().min(1),
  sale_price: z.coerce.number().finite().nonnegative(),
  sku: z.string().min(1),
  status: z.literal("active"),
});

type SupabaseProduct = z.infer<typeof supabaseProductSchema>;

// Requires the vw_site_products database VIEW to exist; this repository intentionally
// has no fallback to the internal products table.
const SITE_PRODUCTS_VIEW = "vw_site_products";

function mapProduct(product: SupabaseProduct): OrderBuilderProduct {
  return {
    colors: [],
    defaultImageAlt: product.image_url ? product.name : "",
    defaultImageUrl: product.image_url ?? "",
    description: product.description ?? "",
    id: product.id,
    name: product.name,
    priceInCents: Math.round(product.sale_price * 100),
    reference: product.sku,
    sizes: [],
    status: product.status,
    variations: [],
  };
}

export class SupabaseProductRepository implements ProductRepository {
  async getProducts() {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(SITE_PRODUCTS_VIEW)
      .select("id,sku,name,description,sale_price,image_url,status")
      .eq("status", "active");

    if (error) {
      throw new Error(`Unable to load products from Supabase: ${error.message}`);
    }

    const products = z.array(supabaseProductSchema).parse(data);

    return orderBuilderProductsSchema.parse(products.map(mapProduct));
  }

  async getProductByReference(reference: string) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(SITE_PRODUCTS_VIEW)
      .select("id,sku,name,description,sale_price,image_url,status")
      .eq("sku", reference)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load product from Supabase: ${error.message}`);
    }

    return data
      ? orderBuilderProductsSchema.element.parse(
          mapProduct(supabaseProductSchema.parse(data)),
        )
      : null;
  }
}
