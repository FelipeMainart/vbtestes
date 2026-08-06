import type { Metadata } from "next";

import { InstitutionalPage } from "@/features/institutional/presentation/components/institutional-page";
import { purchasePolicyContent } from "@/features/institutional/presentation/content/institutional-content";

export const metadata: Metadata = {
  title: "Política de Compra",
  description:
    "Consulte as condições para montar, confirmar, pagar e receber seu pedido atacarejo Veste Bem.",
};

export default function PurchasePolicyPage() {
  return <InstitutionalPage content={purchasePolicyContent} />;
}
