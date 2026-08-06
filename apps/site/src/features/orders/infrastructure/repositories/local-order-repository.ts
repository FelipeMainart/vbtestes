import type { MockOrder } from "../../domain/entities/order";
import {
  localOrderSchema,
  localOrdersSchema,
} from "../schemas/local-orders.schema";

const storageKey = "veste-bem:orders";
const maximumStoredOrders = 5;

export class LocalOrderRepository {
  findById(id: string): MockOrder | null {
    const snapshot = this.loadSnapshot();
    return snapshot.orders.find((order) => order.id === id) ?? null;
  }

  save(input: MockOrder): boolean {
    try {
      const order = localOrderSchema.parse(input);
      const current = this.loadSnapshot().orders.filter(
        (storedOrder) => storedOrder.id !== order.id,
      );
      const snapshot = localOrdersSchema.parse({
        orders: [order, ...current].slice(0, maximumStoredOrders),
        version: 1,
      });
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  }

  private loadSnapshot() {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (!storedValue)
        return localOrdersSchema.parse({ orders: [], version: 1 });
      return localOrdersSchema.parse(JSON.parse(storedValue) as unknown);
    } catch {
      return localOrdersSchema.parse({ orders: [], version: 1 });
    }
  }
}
