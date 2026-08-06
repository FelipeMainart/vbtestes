import type { ReactNode } from "react";

import { AppProviders } from "@/providers/app-providers";

type ProvidersProps = Readonly<{
  children: ReactNode;
}>;

export function Providers({ children }: ProvidersProps) {
  return <AppProviders>{children}</AppProviders>;
}
