import type { ReactNode } from "react";

import { MainLayout } from "@/components/layout/main-layout";

type StoreLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function StoreLayout({ children }: StoreLayoutProps) {
  return <MainLayout>{children}</MainLayout>;
}
