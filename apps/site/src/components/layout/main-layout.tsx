import type { ReactNode } from "react";

import { Footer } from "@/components/navigation/footer";
import { Header } from "@/components/navigation/header";

type MainLayoutProps = Readonly<{
  children: ReactNode;
}>;

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}
