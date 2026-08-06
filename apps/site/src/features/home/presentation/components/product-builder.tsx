"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CheckCircle2 } from "lucide-react";

import {
  CartPanel,
  summarizeOrder,
  type CartAddResult,
  type CartEditResult,
  type OrderLine,
} from "@/features/cart";
import type { OrderBuilderProduct } from "@/features/product";
import { cartService } from "@/lib/composition/cart.client";
import { ROUTES } from "@/constants/routes";
import { calculateShippingAction } from "@/features/checkout";

import { ProductConfiguratorCard } from "./product-configurator-card";
import styles from "./landing-commerce.module.css";

type ProductBuilderProps = Readonly<{
  initialNotice?: string;
  products: readonly OrderBuilderProduct[];
}>;

const loadMessages = {
  invalid: "O pedido salvo não era compatível e foi reiniciado com segurança.",
  recovered:
    "Algumas peças salvas deixaram de estar disponíveis e foram removidas.",
  unavailable:
    "Não foi possível acessar o pedido salvo. Você pode continuar montando nesta página.",
} as const;

export function ProductBuilder({
  initialNotice,
  products,
}: ProductBuilderProps) {
  const router = useRouter();
  const [lines, setLines] = useState<readonly OrderLine[]>([]);
  const [feedback, setFeedback] = useState<Readonly<{
    message: string;
    title: string;
  }> | null>(
    initialNotice ? { message: initialNotice, title: "Pedido mínimo" } : null,
  );
  const [isCartUpdating, setIsCartUpdating] = useState(true);
  const summary = summarizeOrder(lines);

  useEffect(() => {
    let isActive = true;

    async function loadCart() {
      const result = await cartService.load(products);

      if (!isActive) return;
      setLines(result.lines);

      if (result.status in loadMessages) {
        setFeedback({
          message: loadMessages[result.status as keyof typeof loadMessages],
          title: "Pedido recuperado",
        });
      } else if (result.persistence === "failed") {
        setFeedback({
          message:
            "Seu pedido foi recuperado, mas não poderá ser salvo neste navegador.",
          title: "Persistência indisponível",
        });
      }
      setIsCartUpdating(false);
    }

    void loadCart();
    return () => {
      isActive = false;
    };
  }, [products]);

  useEffect(() => {
    if (!feedback) return;
    const timeoutId = window.setTimeout(() => setFeedback(null), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  async function handleAdd(
    product: OrderBuilderProduct,
    colorId: string | null,
    sizeId: string | null,
    quantity: number,
  ): Promise<CartAddResult> {
    setIsCartUpdating(true);
    const result = await cartService.add(lines, {
      colorId,
      product,
      quantity,
      sizeId,
    });

    if (result.ok) {
      setLines(result.lines);
      setFeedback({
        message: `${quantity} × ${result.addedLine.name}, ${result.addedLine.colorLabel}, tamanho ${result.addedLine.sizeLabel}. Agora você tem ${result.summary.totalPieces} peças.${result.persistence === "failed" ? " Não foi possível salvar esta alteração no navegador." : ""}`,
        title: "Adicionado ao pedido",
      });
    }

    setIsCartUpdating(false);
    return result;
  }

  async function handleEdit(
    operation: () => Promise<CartEditResult>,
    successMessage: string,
  ) {
    setIsCartUpdating(true);
    const result = await operation();

    if (result.ok) {
      setLines(result.lines);
      setFeedback({
        message: `${successMessage}${result.persistence === "failed" ? " A alteração não pôde ser salva no navegador." : ""}`,
        title: "Seu pedido foi atualizado",
      });
    }

    setIsCartUpdating(false);
  }

  function handleIncrement(variationId: string) {
    void handleEdit(
      () => cartService.increment(lines, variationId),
      "Quantidade atualizada.",
    );
  }

  function handleDecrement(variationId: string) {
    void handleEdit(
      () => cartService.decrement(lines, variationId),
      "Quantidade atualizada.",
    );
  }

  function handleRemove(variationId: string) {
    void handleEdit(
      () => cartService.remove(lines, variationId),
      "Peça removida do pedido.",
    );
  }

  return (
    <div className={styles.builderLayout}>
      <div className={styles.productList}>
        {feedback && (
          <div className={styles.addFeedback} role="status" aria-live="polite">
            <span className={styles.feedbackIcon} aria-hidden="true">
              <CheckCircle2 size={20} strokeWidth={2} />
            </span>
            <span className={styles.feedbackCopy}>
              <strong>{feedback.title}</strong>
              <span>{feedback.message}</span>
            </span>
          </div>
        )}
        {products.map((product) => (
          <ProductConfiguratorCard
            key={product.id}
            isCartUpdating={isCartUpdating}
            onAdd={handleAdd}
            product={product}
          />
        ))}
      </div>
      <CartPanel
        isUpdating={isCartUpdating}
        lines={lines}
        onDecrement={handleDecrement}
        onIncrement={handleIncrement}
        onRemove={handleRemove}
        onCalculateShipping={calculateShippingAction}
        onFinalize={(selection) => {
          const query = selection
            ? `?postalCode=${encodeURIComponent(selection.postalCode)}&shipping=${selection.option.id}`
            : "";
          router.push(`${ROUTES.checkout}${query}` as Route);
        }}
        summary={summary}
      />
    </div>
  );
}
