import type { MockOrder } from "../entities/order";

export interface OrderRepository {
  findById(id: string): Promise<MockOrder | null>;
  findByIdempotencyKey(key: string): Promise<MockOrder | null>;
  nextNumber(): Promise<string>;
  save(order: MockOrder, idempotencyKey: string): Promise<MockOrder>;
}
