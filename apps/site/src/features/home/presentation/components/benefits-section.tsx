import { Check } from "lucide-react";

import type { HomeContent } from "../../domain/entities/home-content";
import styles from "./landing-commerce.module.css";

type BenefitsSectionProps = Readonly<{
  benefits: HomeContent["benefits"];
}>;

export function BenefitsSection({ benefits }: BenefitsSectionProps) {
  return (
    <section className={styles.benefits} aria-labelledby="home-benefits-title">
      <div className="ds-container">
        <h2 className={styles.visuallyHidden} id="home-benefits-title">
          {benefits.title}
        </h2>
        <ul className={styles.benefitsList}>
          {benefits.items.slice(0, 4).map((benefit) => (
            <li key={benefit.id}>
              <span className={styles.benefitIcon} aria-hidden="true">
                <Check size={15} strokeWidth={2} />
              </span>
              <span className={styles.benefitCopy}>
                <strong>{benefit.title}</strong>
                <small>{benefit.description}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
