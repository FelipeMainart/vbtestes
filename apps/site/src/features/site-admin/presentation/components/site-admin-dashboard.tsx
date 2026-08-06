import Link from "next/link";

import styles from "./site-admin.module.css";

export function SiteAdminDashboard() {
  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Administração</p>
        <h1 className={styles.title}>Painel do Site</h1>
        <p className={styles.description}>
          Gerencie a apresentação dos produtos no Site.
        </p>
      </header>

      <div className={styles.dashboardGrid}>
        <Link className={styles.dashboardCard} href="/painel/produtos">
          <h2>Produtos</h2>
          <p>Consulte os produtos cadastrados e seus dados de apresentação.</p>
        </Link>
      </div>
    </>
  );
}
