import "server-only";

import { SiteAdminAuthService } from "@/features/site-admin/application/services/site-admin-auth-service";
import { SupabaseSiteAdminAuthRepository } from "@/features/site-admin/infrastructure/repositories/supabase-site-admin-auth-repository";

export function createSiteAdminAuthService() {
  return new SiteAdminAuthService(new SupabaseSiteAdminAuthRepository());
}
