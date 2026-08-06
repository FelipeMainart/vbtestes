import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { CheckCircle2, Factory, Mail, Truck } from "lucide-react";

import { InstagramIcon } from "@/components/icons/instagram-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { APP_CONFIG } from "@/config/app.config";
import { INSTAGRAM_URL, WHATSAPP_URL } from "@/constants/contact";
import { ROUTES } from "@/constants/routes";

import styles from "./navigation.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`ds-container ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <Link href={ROUTES.home} aria-label={`${APP_CONFIG.name}, início`}>
            <Image
              alt="Veste Bem Moda Alfaiataria"
              className={styles.footerLogo}
              height={115}
              src="/images/brand/veste-bem-logo-white.webp"
              width={180}
            />
          </Link>
          <h2>Empresa</h2>
          <p>
            Alfaiataria feminina em uma experiência atacarejo simples, elegante
            e direta.
          </p>
        </div>

        <div>
          <h2>Navegação</h2>
          <ul>
            <li>
              <Link href="/#modelos">Produtos</Link>
            </li>
            <li>
              <Link href="/#como-funciona">Como funciona</Link>
            </li>
            <li>
              <Link href="/#faq">Dúvidas</Link>
            </li>
            <li>
              <a href="/acompanhar-pedido">Acompanhar pedido</a>
            </li>
          </ul>
        </div>

        <div>
          <h2>Contato</h2>
          <div className={styles.socialLinks}>
            <a
              aria-label="Instagram da Veste Bem"
              href={INSTAGRAM_URL}
              rel="noreferrer"
              target="_blank"
            >
              <InstagramIcon aria-hidden="true" height={20} width={20} />
            </a>
            <a
              aria-label="Conversar com a Veste Bem pelo WhatsApp"
              href={WHATSAPP_URL}
              rel="noreferrer"
              target="_blank"
            >
              <WhatsAppIcon aria-hidden="true" height={20} width={20} />
            </a>
            <a aria-label="E-mail da Veste Bem" href="#email">
              <Mail aria-hidden="true" size={20} />
            </a>
          </div>
        </div>

        <div className={styles.footerPolicies}>
          <h2>Institucional</h2>
          <ul>
            <li>
              <Link href={ROUTES.about as Route}>Sobre a Veste Bem</Link>
            </li>
            <li>
              <Link href={ROUTES.purchasePolicy as Route}>
                Política de Compra
              </Link>
            </li>
            <li>
              <Link href={ROUTES.privacyPolicy as Route}>
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link href={ROUTES.delivery as Route}>Entrega</Link>
            </li>
            <li>
              <Link href={ROUTES.terms as Route}>Termos de Uso</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className={`ds-container ${styles.footerTrust}`}>
        <span>
          <Factory aria-hidden="true" size={16} strokeWidth={1.8} />
          Compra direto da fábrica
        </span>
        <span>
          <CheckCircle2 aria-hidden="true" size={16} strokeWidth={1.8} />
          Pedido mínimo de 6 peças
        </span>
        <span>
          <Truck aria-hidden="true" size={16} strokeWidth={1.8} />
          Entrega para todo o Brasil
        </span>
        <span>
          <WhatsAppIcon aria-hidden="true" height={16} width={16} />
          Atendimento via WhatsApp
        </span>
      </div>

      <div className={`ds-container ${styles.footerBottom}`}>
        <small>© 2026 {APP_CONFIG.name}. Todos os direitos reservados.</small>
        <small>Alfaiataria feminina para todo o Brasil</small>
      </div>
    </footer>
  );
}
