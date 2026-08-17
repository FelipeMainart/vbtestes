"use server";

import { z } from "zod";

import type { SiteProductSettings } from "../../domain/entities/site-product-settings";
import { createSiteProductSettingsRepository } from "@/lib/composition/site-admin";

import { requireSiteAdminUser } from "./site-admin-auth.action";

const updateSettingsSchema = z.object({
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  productId: z.uuid(),
  seoDescription: z.string().transform((value) => value.trim() || null),
  seoTitle: z.string().transform((value) => value.trim() || null),
});

export type UpdateSiteProductSettingsState = Readonly<{
  message: string;
  settings: SiteProductSettings | null;
  status: "error" | "idle" | "success";
}>;

export async function updateSiteProductSettings(
  _state: UpdateSiteProductSettingsState,
  formData: FormData,
): Promise<UpdateSiteProductSettingsState> {
  await requireSiteAdminUser();

  const input = updateSettingsSchema.safeParse({
    isFeatured: formData.get("isFeatured") === "on",
    isPublished: formData.get("isPublished") === "on",
    productId: formData.get("productId"),
    seoDescription: formData.get("seoDescription") ?? "",
    seoTitle: formData.get("seoTitle") ?? "",
  });

  if (!input.success) {
    return {
      message: "Revise os dados informados e tente novamente.",
      settings: null,
      status: "error",
    };
  }

  try {
    const settings = await createSiteProductSettingsRepository().updateSettings(
      input.data.productId,
      {
        isFeatured: input.data.isFeatured,
        isPublished: input.data.isPublished,
        seoDescription: input.data.seoDescription,
        seoTitle: input.data.seoTitle,
      },
    );

    return {
      message: "Configurações salvas com sucesso.",
      settings,
      status: "success",
    };
  } catch (error) {
    console.error("Unable to update site product settings:", error);
    return {
      message: "Não foi possível salvar as configurações. Tente novamente.",
      settings: null,
      status: "error",
    };
  }
}
