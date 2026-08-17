import type { SiteAdminAuthRepository } from "../../domain/repositories/site-admin-auth-repository";

export class SiteAdminAuthService {
  constructor(private readonly repository: SiteAdminAuthRepository) {}

  getAuthenticatedUser() {
    return this.repository.getAuthenticatedUser();
  }

  signIn(email: string, password: string) {
    return this.repository.signIn(email.trim().toLowerCase(), password);
  }

  signOut() {
    return this.repository.signOut();
  }
}
