import type { ReactNode } from "react";

type QueryProviderProps = Readonly<{ children: ReactNode }>;

export function QueryProvider({ children }: QueryProviderProps) {
  return children;
}
