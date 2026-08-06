import {
  ArrowDown,
  CheckCircle2,
  Factory,
  Palette,
  Shirt,
  Truck,
} from "lucide-react";
import Image from "next/image";

import type { HomeContent } from "../../domain/entities/home-content";
import styles from "./landing-commerce.module.css";

type HeroSectionProps = Readonly<{
  hero: HomeContent["hero"];
}>;

export function HeroSection({ hero }: HeroSectionProps) {
  return (
    <section className={styles.hero} aria-labelledby="home-hero-title">
      <div className={`ds-container ${styles.heroGrid}`}>
        <div className={styles.heroContent}>
          <span className={styles.heroFactoryBadge}>
            <Factory aria-hidden="true" size={15} strokeWidth={1.8} />
            Direto da fábrica
          </span>
          <p className="ds-eyebrow">{hero.eyebrow}</p>
          <h1 className={styles.heroTitle} id="home-hero-title">
            {hero.title.split("\n").map((line) => (
              <span
                className={
                  line.toLocaleLowerCase("pt-BR") === "coletes"
                    ? styles.heroTitleEmphasis
                    : undefined
                }
                key={line}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className={styles.heroDescription}>{hero.description}</p>

          <ul
            className={styles.heroIndicators}
            aria-label="Condições principais"
          >
            {hero.indicators.map((indicator, index) => {
              const Icon =
                [CheckCircle2, Palette, Shirt, Truck][index] ?? CheckCircle2;
              const [title, detail] = indicator.split("\n");
              return (
                <li key={indicator}>
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                  <span className={styles.heroIndicatorCopy}>
                    <strong>{title}</strong>
                    {detail && <small>{detail}</small>}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className={styles.heroActions}>
            <a
              className="ds-button ds-button--primary"
              href={hero.primaryAction.href}
            >
              {hero.primaryAction.label}
              <ArrowDown aria-hidden="true" size={18} strokeWidth={2} />
            </a>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroVisualFrame}>
            <Image
              alt="Modelo Veste Bem usando colete feminino de alfaiataria"
              className={styles.heroImage}
              fill
              priority
              sizes="(min-width: 64rem) 65vw, 100vw"
              src="/images/hero/veste-bem-banner.webp"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
