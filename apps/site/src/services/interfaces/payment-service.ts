export type PaymentOption = Readonly<{
  description: string;
  id: "pix" | "card" | "boleto";
  label: string;
}>;

export interface PaymentService {
  listOptions(): Promise<readonly PaymentOption[]>;
}
