import type { PaymentService } from "@/services/interfaces/payment-service";

const options = [
  {
    description: "A equipe envia as instruções e confirma no WhatsApp.",
    id: "pix",
    label: "PIX",
  },
  {
    description: "A loja combina os detalhes com você no WhatsApp.",
    id: "card",
    label: "Cartão",
  },
  {
    description: "A disponibilidade e as condições são confirmadas pela equipe.",
    id: "boleto",
    label: "Boleto",
  },
] as const;

export class MockPaymentService implements PaymentService {
  async listOptions() {
    return options;
  }
}
