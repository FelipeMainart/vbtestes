"use server";

import { createSiteProductMediaRepository } from "@/lib/composition/site-admin";

import { requireSiteAdminUser } from "./site-admin-auth.action";

export type ManageSiteProductMediaResult = Readonly<{
  message: string;
  status: "error" | "success";
}>;

export async function removeSiteProductMedia(
  mediaId: string,
): Promise<ManageSiteProductMediaResult> {
  await requireSiteAdminUser();
  if (!mediaId) {
    return { message: "Imagem inválida.", status: "error" };
  }

  try {
    await createSiteProductMediaRepository().remove(mediaId);
    return { message: "Imagem excluída com sucesso.", status: "success" };
  } catch (error) {
    console.error("Unable to remove site product media:", error);
    return {
      message: "Não foi possível excluir a imagem. Tente novamente.",
      status: "error",
    };
  }
}

export async function setPrimarySiteProductMedia(
  mediaId: string,
): Promise<ManageSiteProductMediaResult> {
  await requireSiteAdminUser();
  if (!mediaId) {
    return { message: "Imagem inválida.", status: "error" };
  }

  try {
    await createSiteProductMediaRepository().setPrimary(mediaId);
    return {
      message: "Imagem principal atualizada com sucesso.",
      status: "success",
    };
  } catch (error) {
    console.error("Unable to set primary site product media:", error);
    return {
      message: "Não foi possível definir a imagem principal. Tente novamente.",
      status: "error",
    };
  }
}

export async function reorderSiteProductMedia(
  colorId: string,
  orderedMediaIds: readonly string[],
): Promise<ManageSiteProductMediaResult> {
  await requireSiteAdminUser();
  if (!colorId || !orderedMediaIds.length) {
    return { message: "Ordem da galeria inválida.", status: "error" };
  }

  const uniqueIds = new Set(orderedMediaIds);

  if (
    uniqueIds.size !== orderedMediaIds.length ||
    orderedMediaIds.some((id) => !id)
  ) {
    return { message: "Ordem da galeria inválida.", status: "error" };
  }

  const repository = createSiteProductMediaRepository();

  try {
    const currentMedia = await repository.getByColorId(colorId);
    const currentIds = new Set(currentMedia.map((media) => media.id));
    const containsSameMedia =
      currentIds.size === orderedMediaIds.length &&
      orderedMediaIds.every((id) => currentIds.has(id));

    if (!containsSameMedia) {
      return {
        message: "A galeria mudou. Atualize a página e tente novamente.",
        status: "error",
      };
    }

    await Promise.all(
      orderedMediaIds.map((mediaId, sortOrder) =>
        repository.updateSortOrder(mediaId, sortOrder),
      ),
    );

    return { message: "Ordem da galeria atualizada.", status: "success" };
  } catch (error) {
    console.error("Unable to reorder site product media:", error);
    return {
      message: "Não foi possível reordenar as imagens. Tente novamente.",
      status: "error",
    };
  }
}
