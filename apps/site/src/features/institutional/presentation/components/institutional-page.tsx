import { ArrowLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { WHATSAPP_URL } from "@/constants/contact";
import { ROUTES } from "@/constants/routes";

import styles from "./institutional-page.module.css";

export type InstitutionalSection = Readonly<{
  items?: readonly string[];
  paragraphs: readonly string[];
  title: string;
}>;

export type InstitutionalPageContent = Readonly<{
  description: string;
  eyebrow: string;
  sections: readonly InstitutionalSection[];
  title: string;
}>;

export function InstitutionalPage({
  content,
}: Readonly<{ content: InstitutionalPageContent }>) {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="institutional-title">
        <div className={`ds-container ${styles.heroInner}`}>
          <Link className={styles.backLink} href={ROUTES.home}>
            <ArrowLeft aria-hidden="true" size={16} /> Voltar para a loja
          </Link>
          <p className="ds-eyebrow">{content.eyebrow}</p>
          <h1 id="institutional-title">{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </section>

      <div className={`ds-container ${styles.contentLayout}`}>
        <aside className={styles.index} aria-label="Nesta página">
          <span>Nesta página</span>
          <ol>
            {content.sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#secao-${index + 1}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </aside>

        <article className={styles.article}>
          {content.sections.map((section, index) => (
            <section id={`secao-${index + 1}`} key={section.title}>
              <span className={styles.sectionNumber} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>
                      <CheckCircle2
                        aria-hidden="true"
                        size={17}
                        strokeWidth={1.8}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <aside className={styles.contactCard}>
            <span aria-hidden="true">
              <WhatsAppIcon height={22} width={22} />
            </span>
            <div>
              <strong>Precisa falar com a Veste Bem?</strong>
              <p>Nossa equipe está disponível para orientar seu pedido.</p>
            </div>
            <a href={WHATSAPP_URL} rel="noreferrer" target="_blank">
              Conversar no WhatsApp
              <ArrowUpRight aria-hidden="true" size={16} />
            </a>
          </aside>
        </article>
      </div>
    </div>
  );
}
