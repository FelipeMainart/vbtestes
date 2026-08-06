import type { OrderRepository } from "../../domain/repositories/order-repository";
import { createOrder } from "../use-cases/create-order";
import type { OrderService } from "./order-service";

export class MockOrderService implements OrderService {
  constructor(private readonly repository: OrderRepository) {}
  create(...args: Parameters<OrderService["create"]>) {
    return createOrder(args[0], args[1], this.repository);
  }
  findById(id: string) {
    return this.repository.findById(id);
  }
}
