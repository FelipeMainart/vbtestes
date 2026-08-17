import type { Metadata } from "next";

import { SiteAdminDashboard } from "@/features/site-admin";

export const metadata: Metadata = { title: "Painel do Site" };

export default function Page() {
  return <SiteAdminDashboard />;
}
