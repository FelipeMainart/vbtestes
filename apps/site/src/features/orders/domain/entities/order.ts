import type { CheckoutReview } from "@/features/checkout/domain/entities/checkout";

export type MockOrder = Readonly<{
  createdAt: string;
  id: string;
  number: string;
  review: CheckoutReview;
  status: "mock-confirmed";
}>;
