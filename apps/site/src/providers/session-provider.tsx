import type { ReactNode } from "react";

type SessionProviderProps = Readonly<{ children: ReactNode }>;

export function SessionProvider({ children }: SessionProviderProps) {
  return children;
}
