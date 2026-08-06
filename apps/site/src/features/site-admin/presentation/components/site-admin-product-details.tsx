import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OrderBuilderProduct } from "@/features/product";

import type { SiteProductColor } from "../../domain/entities/site-product-color";
import type { SiteProductMedia } from "../../domain/entities/site-product-media";
import type { SiteProductSettings } from "../../domain/entities/site-product-settings";
import styles from "./site-admin.module.css";
import { SiteProductGallery } from "./site-product-gallery";

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
        <Card className={styles.panelCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Visibilidade</p>
              <h2>Status do Site</h2>
            </div>
            <span
              className={
                settings?.isPublished
                  ? styles.publishedStatus
                  : styles.unpublishedStatus
              }
            >
              {settings?.isPublished ? "Publicado" : "Não publicado"}
            </span>
          </div>
          <p className={styles.cardDescription}>
            {settings?.isPublished
              ? "Este produto está disponível para apresentação no Site."
              : "Este produto ainda não está disponível para apresentação no Site."}
          </p>
        </Card>

        <Card className={styles.panelCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Galeria</p>
              <h2>Fotos</h2>
            </div>
            <Button disabled variant="secondary">
              Adicionar Foto
            </Button>
          </div>
          <SiteProductGallery colors={colors} mediaByColor={mediaByColor} />
        </Card>

        <Card className={styles.panelCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Apresentação</p>
              <h2>Configuração</h2>
            </div>
          </div>
          <div className={styles.checkboxList}>
            <label className={styles.checkboxRow}>
              <input checked={settings?.isPublished ?? false} disabled type="checkbox" />
              <span>
                <strong>Publicado</strong>
                <small>Exibir este produto no Site.</small>
              </span>
            </label>
            <label className={styles.checkboxRow}>
              <input checked={settings?.isFeatured ?? false} disabled type="checkbox" />
              <span>
                <strong>Produto em destaque</strong>
                <small>Dar visibilidade especial ao produto.</small>
              </span>
            </label>
          </div>
        </Card>

        <Card className={styles.panelCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Busca</p>
              <h2>SEO</h2>
            </div>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Título</span>
              <Input
                aria-describedby="seo-title-help"
                placeholder="Título para mecanismos de busca"
                readOnly
                value={settings?.seoTitle ?? ""}
              />
              <small id="seo-title-help">Título exibido nos resultados de busca.</small>
            </label>
            <label className={styles.field}>
              <span>Descrição</span>
              <textarea
                aria-describedby="seo-description-help"
                className={styles.textarea}
                placeholder="Descrição para mecanismos de busca"
                readOnly
                rows={4}
                value={settings?.seoDescription ?? ""}
              />
              <small id="seo-description-help">
                Resumo usado na apresentação do produto em buscas.
              </small>
            </label>
          </div>
        </Card>
      </div>
    </>
  );
}
