import type { CheckoutReview } from "@/features/checkout/domain/entities/checkout";
import type { OrderRepository } from "../../domain/repositories/order-repository";

export async function createOrder(
  review: CheckoutReview,
  idempotencyKey: string,
  repository: OrderRepository,
) {
  const existing = await repository.findByIdempotencyKey(idempotencyKey);
  if (existing) return existing;
  return repository.save(
    {
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      number: await repository.nextNumber(),
      review,
      status: "mock-confirmed",
    },
    idempotencyKey,
  );
}
