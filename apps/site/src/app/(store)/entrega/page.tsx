import type { Metadata } from "next";

import { InstitutionalPage } from "@/features/institutional/presentation/components/institutional-page";
import { deliveryContent } from "@/features/institutional/presentation/content/institutional-content";

export const metadata: Metadata = {
  title: "Entrega",
  description:
    "Saiba como funcionam modalidades, prazos, rastreamento e recebimento dos pedidos Veste Bem em todo o Brasil.",
};

export default function DeliveryPage() {
  return <InstitutionalPage content={deliveryContent} />;
}
