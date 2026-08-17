import type { SiteAdminUser } from "../entities/site-admin-user";

export interface SiteAdminAuthRepository {
  getAuthenticatedUser(): Promise<SiteAdminUser | null>;
  signIn(email: string, password: string): Promise<SiteAdminUser>;
  signOut(): Promise<void>;
}
