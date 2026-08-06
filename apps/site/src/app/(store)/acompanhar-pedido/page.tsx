import type { Metadata } from "next";

import { OrderTrackingPage } from "@/features/orders/presentation/components/order-tracking-page";

export const metadata: Metadata = {
  title: "Acompanhar pedido",
  description:
    "Consulte o andamento do seu pedido Veste Bem com o número do pedido e os dados informados na compra.",
};

export default function Page() {
  return <OrderTrackingPage />;
}
