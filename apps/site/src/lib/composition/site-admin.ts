import "server-only";

import type { SiteProductColorRepository } from "@/features/site-admin/domain/repositories/site-product-color-repository";
import type { SiteProductMediaRepository } from "@/features/site-admin/domain/repositories/site-product-media-repository";
import type { SiteProductSettingsRepository } from "@/features/site-admin/domain/repositories/site-product-settings-repository";
import { SupabaseSiteProductColorRepository } from "@/features/site-admin/infrastructure/repositories/supabase-site-product-color-repository";
import { SupabaseSiteProductMediaRepository } from "@/features/site-admin/infrastructure/repositories/supabase-site-product-media-repository";
import { SupabaseSiteProductSettingsRepository } from "@/features/site-admin/infrastructure/repositories/supabase-site-product-settings-repository";

export function createSiteProductColorRepository(): SiteProductColorRepository {
  return new SupabaseSiteProductColorRepository();
}

export function createSiteProductMediaRepository(): SiteProductMediaRepository {
  return new SupabaseSiteProductMediaRepository();
}

export function createSiteProductSettingsRepository(): SiteProductSettingsRepository {
  return new SupabaseSiteProductSettingsRepository();
}
