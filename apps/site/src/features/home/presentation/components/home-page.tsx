import { ArrowUpRight } from "lucide-react";

import { InstagramIcon } from "@/components/icons/instagram-icon";
import { INSTAGRAM_URL } from "@/constants/contact";
import type { ProductService } from "@/features/product";

import type { HomeService } from "../../application/services/home-service";
import { BenefitsSection } from "./benefits-section";
import { FaqSection } from "./faq-section";
import { FeaturedProductsSection } from "./featured-products-section";
import { HeroSection } from "./hero-section";
import { HowItWorksSection } from "./how-it-works-section";
import styles from "./landing-commerce.module.css";

type HomePageProps = Readonly<{
  homeService: HomeService;
  initialNotice?: string;
  productService: ProductService;
}>;

export async function HomePage({
  homeService,
  initialNotice,
  productService,
}: HomePageProps) {
  const [content, products] = await Promise.all([
    homeService.getContent(),
    productService.getProducts(),
  ]);

  return (
    <div className={styles.landingPage}>
      <HeroSection hero={content.hero} />
      <FeaturedProductsSection
        featuredProducts={content.featuredProducts}
        initialNotice={initialNotice}
        products={products}
      />
      <BenefitsSection benefits={content.benefits} />
      <section
        className={styles.instagramStrip}
        id="instagram"
        aria-label="Instagram Veste Bem"
      >
        <div className="ds-container">
          <span className={styles.instagramIcon} aria-hidden="true">
            <InstagramIcon height={24} width={24} />
          </span>
          <div className={styles.instagramCopy}>
            <strong>Siga nossa marca no Instagram</strong>
            <span>
              Veja lançamentos, combinações, bastidores da produção e
              inspirações da coleção.
            </span>
          </div>
          <a
            className="ds-button ds-button--secondary"
            href={INSTAGRAM_URL}
            rel="noreferrer"
            target="_blank"
          >
            Seguir @vbmodaalfaiataria
            <ArrowUpRight aria-hidden="true" size={17} />
          </a>
        </div>
      </section>
      <HowItWorksSection howItWorks={content.howItWorks} />
      <FaqSection faq={content.faq} />
    </div>
  );
}
