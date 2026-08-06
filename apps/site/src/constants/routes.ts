export const ROUTES = {
  about: "/sobre-a-veste-bem",
  checkout: "/checkout",
  delivery: "/entrega",
  home: "/",
  privacyPolicy: "/politica-de-privacidade",
  purchasePolicy: "/politica-de-compra",
  terms: "/termos-de-uso",
  tracking: "/acompanhar-pedido",
} as const;

export function orderSuccessRoute(id: string) {
  return `/pedido/${encodeURIComponent(id)}/sucesso` as const;
}
