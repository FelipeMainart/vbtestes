import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { OrderBuilderProduct } from "@/features/product";

import type { SiteProductColor } from "../../domain/entities/site-product-color";
import type { SiteProductMedia } from "../../domain/entities/site-product-media";
import type { SiteProductSettings } from "../../domain/entities/site-product-settings";
import styles from "./site-admin.module.css";
import { SiteProductGallery } from "./site-product-gallery";
import { SiteProductSettingsForm } from "./site-product-settings-form";

type SiteAdminProductDetailsProps = Readonly<{
  colors: readonly SiteProductColor[];
  mediaByColor: Readonly<Record<string, readonly SiteProductMedia[]>>;
  product: OrderBuilderProduct;
  settings: SiteProductSettings | null;
}>;

export function SiteAdminProductDetails({
  colors,
  mediaByColor,
  product,
  settings,
}: SiteAdminProductDetailsProps) {
  return (
    <>
      <Link className={styles.backLink} href="/painel/produtos">
        ← Voltar para produtos
      </Link>

      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Detalhes do produto</p>
        <h1 className={styles.title}>{product.name}</h1>
        <p className={styles.productReference}>{product.reference}</p>
      </header>

      <div className={styles.detailsGrid}>
        <SiteProductSettingsForm productId={product.id} settings={settings} />

        <Card className={styles.panelCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Galeria</p>
              <h2>Fotos</h2>
            </div>
          </div>
          <SiteProductGallery colors={colors} mediaByColor={mediaByColor} />
        </Card>
      </div>
    </>
  );
}
