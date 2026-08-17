import type { ReactNode } from "react";

import { SiteAdminLayout } from "@/features/site-admin";
import { requireSiteAdminUser } from "@/features/site-admin/presentation/actions/site-admin-auth.action";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await requireSiteAdminUser();

  return <SiteAdminLayout userEmail={user.email}>{children}</SiteAdminLayout>;
}
