import type { CheckoutReview } from "@/features/checkout/domain/entities/checkout";
import type { MockOrder } from "../../domain/entities/order";

export interface OrderService {
  create(review: CheckoutReview, idempotencyKey: string): Promise<MockOrder>;
  findById(id: string): Promise<MockOrder | null>;
}
