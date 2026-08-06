"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ROUTES } from "@/constants/routes";
import { localOrderRepository } from "@/lib/composition/orders.client";

import type { MockOrder } from "../../domain/entities/order";
import { OrderSuccessPage } from "./order-success-page";
import styles from "./order-success.module.css";

type Props = Readonly<{
  initialOrder: MockOrder | null;
  orderId: string;
}>;

export function OrderSuccessRoute({ initialOrder, orderId }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [hasLoaded, setHasLoaded] = useState(Boolean(initialOrder));

  useEffect(() => {
    if (initialOrder) return;

    async function loadOrder() {
      await Promise.resolve();
      setOrder(localOrderRepository.findById(orderId));
      setHasLoaded(true);
    }

    void loadOrder();
  }, [initialOrder, orderId]);

  if (!hasLoaded) {
    return (
      <div className={styles.routeStatus} role="status">
        Recuperando seu pedido…
      </div>
    );
  }

  if (!order) {
    return (
      <main className={styles.routeStatus}>
        <AlertCircle aria-hidden="true" size={28} />
        <h1>Não foi possível recuperar este pedido.</h1>
        <p>Confira se você está usando o mesmo navegador da finalização.</p>
        <Link className="ds-button ds-button--primary" href={ROUTES.home}>
          Voltar para a loja
        </Link>
      </main>
    );
  }

  return <OrderSuccessPage order={order} />;
}
