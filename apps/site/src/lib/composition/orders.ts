import "server-only";

import { MockOrderService } from "@/features/orders/application/services/mock-order-service";
import type { OrderService } from "@/features/orders/application/services/order-service";
import { MockOrderRepository } from "@/features/orders/infrastructure/repositories/mock-order-repository";

const repository = new MockOrderRepository();
export function createOrderService(): OrderService {
  return new MockOrderService(repository);
}
