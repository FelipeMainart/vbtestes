import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";

type AuthLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <Container as="main">{children}</Container>;
}
