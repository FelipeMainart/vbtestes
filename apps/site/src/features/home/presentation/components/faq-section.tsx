import { Plus } from "lucide-react";

import type { HomeContent } from "../../domain/entities/home-content";
import styles from "./landing-commerce.module.css";

type FaqSectionProps = Readonly<{
  faq: HomeContent["faq"];
}>;

export function FaqSection({ faq }: FaqSectionProps) {
  return (
    <section className={styles.faq} id="faq" aria-labelledby="home-faq-title">
      <div className={`ds-container ${styles.faqGrid}`}>
        <div className={styles.faqIntro}>
          <p className="ds-eyebrow">Dúvidas</p>
          <h2 className="ds-section-title" id="home-faq-title">
            {faq.title}
          </h2>
          <p>Tudo o que você precisa saber para montar sua primeira seleção.</p>
        </div>
        <div className={styles.faqList}>
          {faq.items.map((item) => (
            <details key={item.id}>
              <summary>
                <span>{item.question}</span>
                <Plus aria-hidden="true" size={18} strokeWidth={2} />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
