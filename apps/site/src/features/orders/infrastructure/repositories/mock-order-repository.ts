import type { MockOrder } from "../../domain/entities/order";
import type { OrderRepository } from "../../domain/repositories/order-repository";

const orders = new Map<string, MockOrder>();
const idempotencyIndex = new Map<string, string>();
let sequence = 0;

export class MockOrderRepository implements OrderRepository {
  async findById(id: string) {
    return orders.get(id) ?? null;
  }
  async findByIdempotencyKey(key: string) {
    const id = idempotencyIndex.get(key);
    return id ? (orders.get(id) ?? null) : null;
  }
  async nextNumber() {
    sequence += 1;
    return `VB${new Date().getFullYear()}${String(sequence).padStart(5, "0")}`;
  }
  async save(order: MockOrder, idempotencyKey: string) {
    const existing = await this.findByIdempotencyKey(idempotencyKey);
    if (existing) return existing;
    orders.set(order.id, order);
    idempotencyIndex.set(idempotencyKey, order.id);
    return order;
  }
}
