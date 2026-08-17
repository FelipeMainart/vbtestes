import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { logoutSiteAdmin } from "../actions/site-admin-auth.action";
import styles from "./site-admin.module.css";

type SiteAdminLayoutProps = Readonly<{
  children: ReactNode;
  userEmail: string;
}>;

export function SiteAdminLayout({ children, userEmail }: SiteAdminLayoutProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link className={styles.brand} href="/painel">
            Painel do Site
          </Link>
          <div className={styles.headerActions}>
            <nav className={styles.navigation} aria-label="Navegação do painel">
              <Link href="/painel">Painel</Link>
              <Link href="/painel/produtos">Produtos</Link>
            </nav>
            <span className={styles.userEmail}>{userEmail}</span>
            <form action={logoutSiteAdmin}>
              <Button type="submit" variant="secondary">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
