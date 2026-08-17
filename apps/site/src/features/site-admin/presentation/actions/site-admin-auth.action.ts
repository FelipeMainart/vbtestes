"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSiteAdminAuthService } from "@/lib/composition/site-admin-auth";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SiteAdminLoginState = Readonly<{
  message: string;
}>;

export async function loginSiteAdmin(
  _state: SiteAdminLoginState,
  formData: FormData,
): Promise<SiteAdminLoginState> {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!input.success) {
    return { message: "Informe um e-mail e uma senha válidos." };
  }

  try {
    await createSiteAdminAuthService().signIn(
      input.data.email,
      input.data.password,
    );
  } catch {
    return { message: "E-mail ou senha inválidos." };
  }

  redirect("/painel");
}

export async function logoutSiteAdmin() {
  await createSiteAdminAuthService().signOut();
  redirect("/painel/login");
}

export async function requireSiteAdminUser() {
  const user = await createSiteAdminAuthService().getAuthenticatedUser();

  if (!user) redirect("/painel/login");

  return user;
}
