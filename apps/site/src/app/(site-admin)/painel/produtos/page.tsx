import type { Metadata } from "next";

import { SiteAdminProducts } from "@/features/site-admin";
import { createProductService } from "@/lib/composition/product";

export const metadata: Metadata = { title: "Produtos | Painel do Site" };

export default async function Page() {
  const products = await createProductService().getProducts();

  return <SiteAdminProducts products={products} />;
}
