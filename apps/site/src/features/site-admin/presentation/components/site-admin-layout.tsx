import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./site-admin.module.css";

type SiteAdminLayoutProps = Readonly<{
  children: ReactNode;
}>;

export function SiteAdminLayout({ children }: SiteAdminLayoutProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link className={styles.brand} href="/painel">
            Painel do Site
          </Link>
          <nav className={styles.navigation} aria-label="Navegação do painel">
            <Link href="/painel">Painel</Link>
            <Link href="/painel/produtos">Produtos</Link>
          </nav>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
