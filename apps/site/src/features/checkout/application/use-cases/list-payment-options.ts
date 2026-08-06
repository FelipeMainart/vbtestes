import type { PaymentService } from "@/services/interfaces/payment-service";

export function listPaymentOptions(service: PaymentService) {
  return service.listOptions();
}
