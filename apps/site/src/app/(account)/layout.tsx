import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";

type AccountLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AccountLayout({ children }: AccountLayoutProps) {
  return <Container as="main">{children}</Container>;
}
