import type { ReactNode } from "react";

import { SiteAdminLayout } from "@/features/site-admin";

type AdminLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <SiteAdminLayout>{children}</SiteAdminLayout>;
}
