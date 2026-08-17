import "server-only";

import { createSupabaseAdminServerClient } from "@/lib/supabase/admin";

import type { SiteProductSettings } from "../../domain/entities/site-product-settings";
import type { SiteProductSettingsRepository } from "../../domain/repositories/site-product-settings-repository";
import {
  siteProductSettingsRowSchema,
  type SiteProductSettingsRow,
} from "../schemas/site-product-settings.schema";

const tableName = "site_product_settings";
const columns =
  "product_id,is_published,is_featured,seo_title,seo_description,published_at,created_at,updated_at";

function mapSettings(row: SiteProductSettingsRow): SiteProductSettings {
  return {
    createdAt: row.created_at,
    isFeatured: row.is_featured,
    isPublished: row.is_published,
    productId: row.product_id,
    publishedAt: row.published_at,
    seoDescription: row.seo_description,
    seoTitle: row.seo_title,
    updatedAt: row.updated_at,
  };
}

export class SupabaseSiteProductSettingsRepository implements SiteProductSettingsRepository {
  async getByProductId(productId: string) {
    const supabase = createSupabaseAdminServerClient();
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .eq("product_id", productId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load site product settings: ${error.message}`);
    }

    return data ? mapSettings(siteProductSettingsRowSchema.parse(data)) : null;
  }

  publish(productId: string) {
    return this.upsert(productId, {
      is_published: true,
      published_at: new Date().toISOString(),
    });
  }

  unpublish(productId: string) {
    return this.upsert(productId, {
      is_published: false,
      published_at: null,
    });
  }

  updateSeo(
    productId: string,
    input: Parameters<SiteProductSettingsRepository["updateSeo"]>[1],
  ) {
    return this.upsert(productId, {
      seo_description: input.description,
      seo_title: input.title,
    });
  }

  updateDisplaySettings(
    productId: string,
    input: Parameters<
      SiteProductSettingsRepository["updateDisplaySettings"]
    >[1],
  ) {
    return this.upsert(productId, { is_featured: input.isFeatured });
  }

  async updateSettings(
    productId: string,
    input: Parameters<SiteProductSettingsRepository["updateSettings"]>[1],
  ) {
    const currentSettings = await this.getByProductId(productId);

    return this.upsert(productId, {
      is_featured: input.isFeatured,
      is_published: input.isPublished,
      published_at: input.isPublished
        ? (currentSettings?.publishedAt ?? new Date().toISOString())
        : null,
      seo_description: input.seoDescription,
      seo_title: input.seoTitle,
    });
  }

  private async upsert(
    productId: string,
    values: Record<string, boolean | string | null>,
  ) {
    const supabase = createSupabaseAdminServerClient();
    const { data, error } = await supabase
      .from(tableName)
      .upsert(
        { product_id: productId, ...values },
        { onConflict: "product_id" },
      )
      .select(columns)
      .single();

    if (error) {
      throw new Error(
        `Unable to update site product settings: ${error.message}`,
      );
    }

    return mapSettings(siteProductSettingsRowSchema.parse(data));
  }
}
