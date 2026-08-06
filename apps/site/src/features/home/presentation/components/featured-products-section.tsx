import type { OrderBuilderProduct } from "@/features/product";

import type { HomeContent } from "../../domain/entities/home-content";
import styles from "./landing-commerce.module.css";
import { ProductBuilder } from "./product-builder";

type FeaturedProductsSectionProps = Readonly<{
  featuredProducts: HomeContent["featuredProducts"];
  initialNotice?: string;
  products: readonly OrderBuilderProduct[];
}>;

export function FeaturedProductsSection({
  featuredProducts,
  initialNotice,
  products,
}: FeaturedProductsSectionProps) {
  return (
    <section
      className={styles.productsSection}
      id="modelos"
      aria-labelledby="featured-products-title"
    >
      <div className="ds-container">
        <div className={styles.productsHeading}>
          <p className="ds-eyebrow">{featuredProducts.eyebrow}</p>
          <h2 className="ds-section-title" id="featured-products-title">
            Escolha seus modelos
          </h2>
          <p>{featuredProducts.description}</p>
        </div>

        <ProductBuilder initialNotice={initialNotice} products={products} />
      </div>
    </section>
  );
}
