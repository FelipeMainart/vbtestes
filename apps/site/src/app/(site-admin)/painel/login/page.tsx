import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSiteAdminAuthService } from "@/lib/composition/site-admin-auth";
import { SiteAdminLoginForm } from "@/features/site-admin/presentation/components/site-admin-login-form";
import styles from "@/features/site-admin/presentation/components/site-admin.module.css";

export const metadata: Metadata = { title: "Login | Painel do Site" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await createSiteAdminAuthService().getAuthenticatedUser();

  if (user) redirect("/painel");

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <p className={styles.cardEyebrow}>Acesso restrito</p>
        <h1>Painel do Site</h1>
        <p>Entre com sua conta para gerenciar o conteúdo do Site.</p>
        <SiteAdminLoginForm />
      </section>
    </main>
  );
}
