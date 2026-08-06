import type { ReactNode } from "react";

type CheckoutLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function CheckoutLayout({ children }: CheckoutLayoutProps) {
  return <>{children}</>;
}
