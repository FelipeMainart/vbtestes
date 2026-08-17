"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { SiteProductSettings } from "../../domain/entities/site-product-settings";
import {
  updateSiteProductSettings,
  type UpdateSiteProductSettingsState,
} from "../actions/update-site-product-settings.action";
import styles from "./site-admin.module.css";

const initialActionState: UpdateSiteProductSettingsState = {
  message: "",
  settings: null,
  status: "idle",
};

type FormValues = Readonly<{
  isFeatured: boolean;
  isPublished: boolean;
  seoDescription: string;
  seoTitle: string;
}>;

function getFormValues(settings: SiteProductSettings | null): FormValues {
  return {
    isFeatured: settings?.isFeatured ?? false,
    isPublished: settings?.isPublished ?? false,
    seoDescription: settings?.seoDescription ?? "",
    seoTitle: settings?.seoTitle ?? "",
  };
}

export function SiteProductSettingsForm({
  productId,
  settings,
}: Readonly<{ productId: string; settings: SiteProductSettings | null }>) {
  const router = useRouter();
  const [values, setValues] = useState(() => getFormValues(settings));
  const [actionState, formAction, isPending] = useActionState(
    updateSiteProductSettings,
    initialActionState,
  );

  useEffect(() => {
    if (actionState.status === "success" && actionState.settings) {
      router.refresh();
    }
  }, [actionState, router]);

  return (
    <form action={formAction} className={styles.settingsForm}>
      <input name="productId" type="hidden" value={productId} />

      <Card className={styles.panelCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Visibilidade</p>
            <h2>Status do Site</h2>
          </div>
          <span
            className={
              values.isPublished
                ? styles.publishedStatus
                : styles.unpublishedStatus
            }
          >
            {values.isPublished ? "Publicado" : "Não publicado"}
          </span>
        </div>
        <div className={styles.checkboxList}>
          <label className={styles.checkboxRow}>
            <input
              checked={values.isPublished}
              disabled={isPending}
              name="isPublished"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  isPublished: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>
              <strong>Publicado</strong>
              <small>Exibir este produto no Site.</small>
            </span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              checked={values.isFeatured}
              disabled={isPending}
              name="isFeatured"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  isFeatured: event.target.checked,
                }))
              }
              type="checkbox"
            />
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
              disabled={isPending}
              name="seoTitle"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  seoTitle: event.target.value,
                }))
              }
              placeholder="Título para mecanismos de busca"
              value={values.seoTitle}
            />
            <small id="seo-title-help">
              Título exibido nos resultados de busca.
            </small>
          </label>
          <label className={styles.field}>
            <span>Descrição</span>
            <textarea
              aria-describedby="seo-description-help"
              className={styles.textarea}
              disabled={isPending}
              name="seoDescription"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  seoDescription: event.target.value,
                }))
              }
              placeholder="Descrição para mecanismos de busca"
              rows={4}
              value={values.seoDescription}
            />
            <small id="seo-description-help">
              Resumo usado na apresentação do produto em buscas.
            </small>
          </label>
        </div>
        <div className={styles.settingsActions}>
          {actionState.status !== "idle" ? (
            <p
              aria-live="polite"
              className={
                actionState.status === "success"
                  ? styles.uploadSuccess
                  : styles.uploadError
              }
              role="status"
            >
              {actionState.message}
            </p>
          ) : null}
          <Button disabled={isPending} type="submit">
            {isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
