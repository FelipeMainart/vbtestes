import type { PaymentService } from "@/services/interfaces/payment-service";

const options = [
  {
    description: "Interface demonstrativa, sem geração de cobrança.",
    id: "pix",
    label: "PIX",
  },
  {
    description: "Nenhum dado de cartão será solicitado nesta versão.",
    id: "card",
    label: "Cartão",
  },
  {
    description: "Interface demonstrativa, sem emissão de boleto.",
    id: "boleto",
    label: "Boleto",
  },
] as const;

export class MockPaymentService implements PaymentService {
  async listOptions() {
    return options;
  }
}
