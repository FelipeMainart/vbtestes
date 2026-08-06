import { CheckCircle2, Palette, Ruler, ShoppingBag } from "lucide-react";

import type { HomeContent } from "../../domain/entities/home-content";
import styles from "./landing-commerce.module.css";

type HowItWorksSectionProps = Readonly<{
  howItWorks: HomeContent["howItWorks"];
}>;

export function HowItWorksSection({ howItWorks }: HowItWorksSectionProps) {
  const icons = [Palette, Ruler, ShoppingBag, CheckCircle2] as const;

  return (
    <section
      className={styles.howItWorks}
      id="como-funciona"
      aria-labelledby="how-it-works-title"
    >
      <div className="ds-container">
        <div className="ds-section-header">
          <p className="ds-eyebrow">Compra direta</p>
          <h2 className="ds-section-title" id="how-it-works-title">
            {howItWorks.title}
          </h2>
          <p className="ds-section-description">{howItWorks.description}</p>
        </div>
        <ol className={styles.stepsList}>
          {howItWorks.steps.map((step, index) => (
            <li key={step.id}>
              <span className={styles.stepIcon} aria-hidden="true">
                {(() => {
                  const Icon = icons[index] ?? CheckCircle2;
                  return <Icon size={20} strokeWidth={2} />;
                })()}
              </span>
              <span className={styles.stepNumber} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
