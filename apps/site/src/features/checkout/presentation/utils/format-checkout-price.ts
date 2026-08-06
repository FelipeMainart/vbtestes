const formatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function formatCheckoutPrice(valueInCents: number) {
  return formatter.format(valueInCents / 100);
}
