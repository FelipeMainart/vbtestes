import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/constants/locales";

export function formatHomePrice(priceInCents: number) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    currency: DEFAULT_CURRENCY,
    style: "currency",
  }).format(priceInCents / 100);
}
