import "server-only";

import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import type { SiteAdminUser } from "../../domain/entities/site-admin-user";
import type { SiteAdminAuthRepository } from "../../domain/repositories/site-admin-auth-repository";

function mapUser(id: string, email: string | undefined): SiteAdminUser {
  if (!email) {
    throw new Error("Authenticated user does not have an email address.");
  }

  return { email, id };
}

export class SupabaseSiteAdminAuthRepository implements SiteAdminAuthRepository {
  async getAuthenticatedUser() {
    const supabase = await createSupabaseAuthServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    return mapUser(user.id, user.email);
  }

  async signIn(email: string, password: string) {
    const supabase = await createSupabaseAuthServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new Error("Invalid login credentials.");
    }

    return mapUser(data.user.id, data.user.email);
  }

  async signOut() {
    const supabase = await createSupabaseAuthServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`Unable to sign out: ${error.message}`);
    }
  }
}
