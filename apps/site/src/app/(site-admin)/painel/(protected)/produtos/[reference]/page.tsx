import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteAdminProductDetails } from "@/features/site-admin";
import { requireSiteAdminUser } from "@/features/site-admin/presentation/actions/site-admin-auth.action";
import { createProductService } from "@/lib/composition/product";
import {
  createSiteProductColorRepository,
  createSiteProductMediaRepository,
  createSiteProductSettingsRepository,
} from "@/lib/composition/site-admin";

export const metadata: Metadata = {
  title: "Detalhes do produto | Painel do Site",
};

type ProductDetailsPageProps = Readonly<{
  params: Promise<{ reference: string }>;
}>;

export default async function Page({ params }: ProductDetailsPageProps) {
  await requireSiteAdminUser();
  const { reference } = await params;
  const product = await createProductService().getProductByReference(reference);

  if (!product) {
    notFound();
  }

  const colorRepository = createSiteProductColorRepository();
  const mediaRepository = createSiteProductMediaRepository();
  const settingsRepository = createSiteProductSettingsRepository();
  const [colors, settings] = await Promise.all([
    colorRepository.getByProductId(product.id),
    settingsRepository.getByProductId(product.id),
  ]);
  const mediaEntries = await Promise.all(
    colors.map(
      async (color) =>
        [color.id, await mediaRepository.getByColorId(color.id)] as const,
    ),
  );

  return (
    <SiteAdminProductDetails
      colors={colors}
      mediaByColor={Object.fromEntries(mediaEntries)}
      product={product}
      settings={settings}
    />
  );
}
