import "server-only";

import { z } from "zod";

import { createSupabaseAdminServerClient } from "@/lib/supabase/admin";

import type {
  CreateSiteProductMediaInput,
  SiteProductMedia,
} from "../../domain/entities/site-product-media";
import type { SiteProductMediaRepository } from "../../domain/repositories/site-product-media-repository";
import {
  siteProductMediaRowSchema,
  type SiteProductMediaRow,
} from "../schemas/site-product-media.schema";

const tableName = "site_product_media";
const columns =
  "id,product_color_id,storage_path,alt_text,is_primary,sort_order,mime_type,width,height,created_at,updated_at";

function mapMedia(
  row: SiteProductMediaRow,
  imageUrl: string,
): SiteProductMedia {
  return {
    altText: row.alt_text,
    createdAt: row.created_at,
    height: row.height,
    id: row.id,
    imageUrl,
    isPrimary: row.is_primary,
    mimeType: row.mime_type,
    productColorId: row.product_color_id,
    sortOrder: row.sort_order,
    storagePath: row.storage_path,
    updatedAt: row.updated_at,
    width: row.width,
  };
}

export class SupabaseSiteProductMediaRepository implements SiteProductMediaRepository {
  async getByColorId(colorId: string) {
    const supabase = createSupabaseAdminServerClient();
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .eq("product_color_id", colorId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Unable to load product media: ${error.message}`);
    }

    return z
      .array(siteProductMediaRowSchema)
      .parse(data)
      .map((row) => this.mapMedia(row));
  }

  async getPrimaryImage(colorId: string) {
    const supabase = createSupabaseAdminServerClient();
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .eq("product_color_id", colorId)
      .eq("is_primary", true)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load primary product image: ${error.message}`);
    }

    return data ? this.mapMedia(siteProductMediaRowSchema.parse(data)) : null;
  }

  async uploadFile(storagePath: string, file: File) {
    const supabase = createSupabaseAdminServerClient();
    const { error } = await supabase.storage
      .from("product-images")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      throw new Error(`Unable to upload product media: ${error.message}`);
    }
  }

  async create(input: CreateSiteProductMediaInput) {
    const supabase = createSupabaseAdminServerClient();
    const { data, error } = await supabase
      .from(tableName)
      .insert({
        alt_text: input.altText ?? "",
        height: input.height ?? null,
        is_primary: input.isPrimary ?? false,
        mime_type: input.mimeType ?? null,
        product_color_id: input.productColorId,
        sort_order: input.sortOrder ?? 0,
        storage_path: input.storagePath,
        width: input.width ?? null,
      })
      .select(columns)
      .single();

    if (error) {
      throw new Error(`Unable to create product media: ${error.message}`);
    }

    return this.mapMedia(siteProductMediaRowSchema.parse(data));
  }

  async remove(mediaId: string) {
    const supabase = createSupabaseAdminServerClient();
    const { data: target, error: targetError } = await supabase
      .from(tableName)
      .select("id,storage_path")
      .eq("id", mediaId)
      .single();

    if (targetError) {
      throw new Error(`Unable to find product media: ${targetError.message}`);
    }

    const parsedTarget = z
      .object({ id: z.string().min(1), storage_path: z.string().min(1) })
      .parse(target);
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove([parsedTarget.storage_path]);

    if (storageError) {
      throw new Error(
        `Unable to remove product media file: ${storageError.message}`,
      );
    }

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", parsedTarget.id);

    if (error) {
      throw new Error(`Unable to remove product media: ${error.message}`);
    }
  }

  async updateSortOrder(mediaId: string, sortOrder: number) {
    const normalizedSortOrder = z.number().int().nonnegative().parse(sortOrder);

    return this.update(mediaId, { sort_order: normalizedSortOrder });
  }

  async setPrimary(mediaId: string) {
    const supabase = createSupabaseAdminServerClient();
    const { data: target, error: targetError } = await supabase
      .from(tableName)
      .select("id,product_color_id")
      .eq("id", mediaId)
      .single();

    if (targetError) {
      throw new Error(`Unable to find product media: ${targetError.message}`);
    }

    const targetSchema = z.object({
      id: z.string().min(1),
      product_color_id: z.string().min(1),
    });
    const parsedTarget = targetSchema.parse(target);
    const { error: resetError } = await supabase
      .from(tableName)
      .update({ is_primary: false })
      .eq("product_color_id", parsedTarget.product_color_id)
      .neq("id", parsedTarget.id);

    if (resetError) {
      throw new Error(
        `Unable to reset primary product image: ${resetError.message}`,
      );
    }

    return this.update(mediaId, { is_primary: true });
  }

  private async update(
    mediaId: string,
    values: Record<string, boolean | number>,
  ) {
    const supabase = createSupabaseAdminServerClient();
    const { data, error } = await supabase
      .from(tableName)
      .update(values)
      .eq("id", mediaId)
      .select(columns)
      .single();

    if (error) {
      throw new Error(`Unable to update product media: ${error.message}`);
    }

    return this.mapMedia(siteProductMediaRowSchema.parse(data));
  }

  private mapMedia(row: SiteProductMediaRow) {
    const supabase = createSupabaseAdminServerClient();
    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(row.storage_path);

    return mapMedia(row, data.publicUrl);
  }
}
