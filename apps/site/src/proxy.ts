import type { NextRequest } from "next/server";

import { updateSiteAdminSession } from "@/lib/supabase/auth-proxy";

export function proxy(request: NextRequest) {
  return updateSiteAdminSession(request);
}

export const config = {
  matcher: ["/painel/:path*"],
};
