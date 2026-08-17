"use server";

import { createSiteProductMediaRepository } from "@/lib/composition/site-admin";

import { requireSiteAdminUser } from "./site-admin-auth.action";

const maximumFileSize = 5 * 1024 * 1024;
const supportedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type UploadSiteProductMediaResult = Readonly<{
  message: string;
  status: "error" | "success";
}>;

export async function uploadSiteProductMedia(
  formData: FormData,
): Promise<UploadSiteProductMediaResult> {
  await requireSiteAdminUser();
  const colorId = String(formData.get("colorId") ?? "").trim();
  const file = formData.get("file");

  if (!colorId) {
    return {
      message: "Selecione uma cor para adicionar a imagem.",
      status: "error",
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { message: "Selecione uma imagem para enviar.", status: "error" };
  }

  const extension = supportedImageTypes.get(file.type);

  if (!extension) {
    return {
      message: "Formato inválido. Envie uma imagem JPG, PNG ou WEBP.",
      status: "error",
    };
  }

  if (file.size > maximumFileSize) {
    return { message: "A imagem deve ter no máximo 5 MB.", status: "error" };
  }

  const storagePath = `site-product-media/${colorId}/${crypto.randomUUID()}.${extension}`;
  const repository = createSiteProductMediaRepository();

  try {
    const currentMedia = await repository.getByColorId(colorId);
    await repository.uploadFile(storagePath, file);
    await repository.create({
      mimeType: file.type,
      productColorId: colorId,
      sortOrder: currentMedia.length,
      storagePath,
    });

    return {
      message: "Imagem adicionada à galeria com sucesso.",
      status: "success",
    };
  } catch (error) {
    console.error("Unable to upload site product media:", error);
    return {
      message: "Não foi possível enviar a imagem. Tente novamente.",
      status: "error",
    };
  }
}
