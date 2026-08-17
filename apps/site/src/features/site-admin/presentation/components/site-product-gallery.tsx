"use client";

import { type ChangeEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SiteProductColor } from "../../domain/entities/site-product-color";
import type { SiteProductMedia } from "../../domain/entities/site-product-media";
import {
  type ManageSiteProductMediaResult,
  removeSiteProductMedia,
  reorderSiteProductMedia,
  setPrimarySiteProductMedia,
} from "../actions/manage-site-product-media.action";
import {
  uploadSiteProductMedia,
  type UploadSiteProductMediaResult,
} from "../actions/upload-site-product-media.action";
import styles from "./site-admin.module.css";

const maximumFileSize = 5 * 1024 * 1024;
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type SiteProductGalleryProps = Readonly<{
  colors: readonly SiteProductColor[];
  mediaByColor: Readonly<Record<string, readonly SiteProductMedia[]>>;
}>;

export function SiteProductGallery({
  colors,
  mediaByColor,
}: SiteProductGalleryProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [isManaging, startManagement] = useTransition();
  const [selectedColorId, setSelectedColorId] = useState(colors[0]?.id ?? "");
  const [uploadResult, setUploadResult] =
    useState<UploadSiteProductMediaResult | null>(null);
  const [managementResult, setManagementResult] =
    useState<ManageSiteProductMediaResult | null>(null);
  const selectedColor = colors.find((color) => color.id === selectedColorId);
  const gallery = selectedColor ? (mediaByColor[selectedColor.id] ?? []) : [];

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!supportedImageTypes.has(file.type)) {
      setUploadResult({
        message: "Formato inválido. Envie uma imagem JPG, PNG ou WEBP.",
        status: "error",
      });
      event.target.value = "";
      return;
    }

    if (file.size > maximumFileSize) {
      setUploadResult({
        message: "A imagem deve ter no máximo 5 MB.",
        status: "error",
      });
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.set("colorId", selectedColorId);
    formData.set("file", file);
    setUploadResult(null);

    startUpload(async () => {
      const result = await uploadSiteProductMedia(formData);
      setUploadResult(result);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  function completeManagement(result: ManageSiteProductMediaResult) {
    setManagementResult(result);

    if (result.status === "success") {
      router.refresh();
    }
  }

  function handleRemove(media: SiteProductMedia) {
    const confirmed = window.confirm(
      "Excluir esta imagem da galeria? Essa ação não pode ser desfeita.",
    );

    if (!confirmed) return;

    setManagementResult(null);
    startManagement(async () => {
      completeManagement(await removeSiteProductMedia(media.id));
    });
  }

  function handleSetPrimary(media: SiteProductMedia) {
    if (media.isPrimary) return;

    setManagementResult(null);
    startManagement(async () => {
      completeManagement(await setPrimarySiteProductMedia(media.id));
    });
  }

  function handleMove(mediaIndex: number, direction: -1 | 1) {
    const destinationIndex = mediaIndex + direction;

    if (destinationIndex < 0 || destinationIndex >= gallery.length) return;

    const reorderedIds = gallery.map((media) => media.id);
    [reorderedIds[mediaIndex], reorderedIds[destinationIndex]] = [
      reorderedIds[destinationIndex],
      reorderedIds[mediaIndex],
    ];

    setManagementResult(null);
    startManagement(async () => {
      completeManagement(
        await reorderSiteProductMedia(selectedColorId, reorderedIds),
      );
    });
  }

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
        <div className={styles.galleryToolbar}>
          <div>
            <span className={styles.galleryLabel}>Galeria do Site</span>
            <small>JPG, PNG ou WEBP, com no máximo 5 MB.</small>
          </div>
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label={`Adicionar imagem à galeria da cor ${selectedColor?.name}`}
            className={styles.visuallyHidden}
            disabled={isUploading}
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <button
            className={styles.uploadButton}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {isUploading ? "Enviando..." : "Adicionar Foto"}
          </button>
        </div>
        {uploadResult ? (
          <p
            aria-live="polite"
            className={
              uploadResult.status === "success"
                ? styles.uploadSuccess
                : styles.uploadError
            }
            role="status"
          >
            {uploadResult.message}
          </p>
        ) : null}
        {managementResult ? (
          <p
            aria-live="polite"
            className={
              managementResult.status === "success"
                ? styles.uploadSuccess
                : styles.uploadError
            }
            role="status"
          >
            {managementResult.message}
          </p>
        ) : null}
        {gallery.length ? (
          <div className={styles.mediaGrid}>
            {gallery.map((media, mediaIndex) => (
              <article className={styles.mediaCard} key={media.id}>
                <div
                  aria-label={
                    media.altText || `Imagem da cor ${selectedColor?.name}`
                  }
                  className={styles.mediaImage}
                  role="img"
                  style={{ backgroundImage: `url("${media.imageUrl}")` }}
                />
                <div className={styles.mediaMeta}>
                  <span>Posição {media.sortOrder + 1}</span>
                  {media.isPrimary ? <strong>Principal no Site</strong> : null}
                </div>
                <div className={styles.mediaActions}>
                  <div className={styles.orderActions}>
                    <button
                      aria-label="Mover imagem para a esquerda"
                      disabled={isManaging || mediaIndex === 0}
                      onClick={() => handleMove(mediaIndex, -1)}
                      type="button"
                    >
                      ←
                    </button>
                    <button
                      aria-label="Mover imagem para a direita"
                      disabled={isManaging || mediaIndex === gallery.length - 1}
                      onClick={() => handleMove(mediaIndex, 1)}
                      type="button"
                    >
                      →
                    </button>
                  </div>
                  <button
                    className={styles.primaryAction}
                    disabled={isManaging || media.isPrimary}
                    onClick={() => handleSetPrimary(media)}
                    type="button"
                  >
                    {media.isPrimary ? "Principal" : "Definir principal"}
                  </button>
                  <button
                    className={styles.removeAction}
                    disabled={isManaging}
                    onClick={() => handleRemove(media)}
                    type="button"
                  >
                    Excluir
                  </button>
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
