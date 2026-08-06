"use client";

import { useState } from "react";

import type { SiteProductColor } from "../../domain/entities/site-product-color";
import type { SiteProductMedia } from "../../domain/entities/site-product-media";
import styles from "./site-admin.module.css";

type SiteProductGalleryProps = Readonly<{
  colors: readonly SiteProductColor[];
  mediaByColor: Readonly<Record<string, readonly SiteProductMedia[]>>;
}>;

export function SiteProductGallery({
  colors,
  mediaByColor,
}: SiteProductGalleryProps) {
  const [selectedColorId, setSelectedColorId] = useState(colors[0]?.id ?? "");
  const selectedColor = colors.find((color) => color.id === selectedColorId);
  const gallery = selectedColor ? (mediaByColor[selectedColor.id] ?? []) : [];

  if (!colors.length) {
    return (
      <div className={styles.photoEmptyState}>
        <strong>Nenhuma cor cadastrada</strong>
      </div>
    );
  }

  return (
    <div className={styles.galleryContent}>
      <div className={styles.colorSelector}>
        <span>Cor</span>
        <div className={styles.colorOptions}>
          {colors.map((color) => (
            <button
              aria-pressed={color.id === selectedColorId}
              className={styles.colorOption}
              data-selected={color.id === selectedColorId}
              key={color.id}
              onClick={() => setSelectedColorId(color.id)}
              type="button"
            >
              {color.name}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.erpImageSection}>
        <div>
          <span className={styles.galleryLabel}>Imagem principal do ERP</span>
          <p>Imagem oficial cadastrada para a cor {selectedColor?.name}.</p>
        </div>
        {selectedColor?.imageUrl ? (
          <div
            aria-label={`Imagem principal da cor ${selectedColor.name}`}
            className={styles.erpImage}
            role="img"
            style={{ backgroundImage: `url("${selectedColor.imageUrl}")` }}
          />
        ) : (
          <div className={styles.imageUnavailable}>Sem imagem principal</div>
        )}
      </section>

      <div>
        <span className={styles.galleryLabel}>Galeria do Site</span>
        {gallery.length ? (
          <div className={styles.mediaGrid}>
            {gallery.map((media) => (
              <article className={styles.mediaCard} key={media.id}>
                <div
                  aria-label={media.altText || `Imagem da cor ${selectedColor?.name}`}
                  className={styles.mediaImage}
                  role="img"
                  style={{ backgroundImage: `url("${media.imageUrl}")` }}
                />
                <div className={styles.mediaMeta}>
                  <span>Posição {media.sortOrder + 1}</span>
                  {media.isPrimary ? <strong>Principal no Site</strong> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.photoEmptyState}>
            <strong>Nenhuma imagem cadastrada</strong>
          </div>
        )}
      </div>
    </div>
  );
}
