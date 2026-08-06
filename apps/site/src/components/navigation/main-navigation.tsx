import styles from "./navigation.module.css";
import { Menu } from "lucide-react";
import Link from "next/link";

export function MainNavigation() {
  return (
    <>
      <details className={styles.mobileNavigation}>
        <summary aria-label="Abrir menu">
          <Menu aria-hidden="true" size={22} />
        </summary>
        <nav aria-label="Navegação móvel">
          <Link href="/#modelos">Produtos</Link>
          <Link href="/#como-funciona">Como funciona</Link>
          <Link href="/#faq">Dúvidas</Link>
          <Link className={styles.mobileTrackingLink} href="/acompanhar-pedido">
            Acompanhar Pedido
          </Link>
        </nav>
      </details>
      <nav className={styles.navigation} aria-label="Navegação principal">
        <Link href="/#modelos">Produtos</Link>
        <Link href="/#como-funciona">Como funciona</Link>
        <Link href="/#faq">Dúvidas</Link>
      </nav>
    </>
  );
}
