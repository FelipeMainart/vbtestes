import type { Metadata } from "next";

import { OrderSuccessRoute } from "@/features/orders/presentation/components/order-success-route";
import { createOrderService } from "@/lib/composition/orders";

export const metadata: Metadata = { title: "Pedido recebido" };

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const order = await createOrderService().findById(id);
  return <OrderSuccessRoute initialOrder={order} orderId={id} />;
}
