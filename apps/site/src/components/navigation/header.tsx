"use client";

import Link from "next/link";
import Image from "next/image";
import { PackageSearch, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { APP_CONFIG } from "@/config/app.config";
import { ROUTES } from "@/constants/routes";

import { MainNavigation } from "./main-navigation";
import styles from "./navigation.module.css";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={styles.header} data-scrolled={isScrolled}>
      <div className={`ds-container ${styles.headerInner}`}>
        <Link
          className={styles.logo}
          href={ROUTES.home}
          aria-label={`${APP_CONFIG.name}, início`}
        >
          <Image
            alt="Veste Bem Moda Alfaiataria"
            className={styles.headerLogoImage}
            height={44}
            sizes="(max-width: 47.99rem) 150px, 220px"
            src="/images/brand/veste-bem-logo.webp"
            width={262}
          />
        </Link>
        <MainNavigation />
        <div className={styles.headerActions}>
          <Link className={styles.headerTracking} href={ROUTES.tracking}>
            <PackageSearch aria-hidden="true" size={17} strokeWidth={2} />
            <span>Acompanhar Pedido</span>
          </Link>
          <Link className={styles.headerOrder} href="/#modelos">
            <ShoppingBag aria-hidden="true" size={17} strokeWidth={2} />
            <span>Começar Pedido</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
