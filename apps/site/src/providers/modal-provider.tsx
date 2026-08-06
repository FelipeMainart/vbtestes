import type { ReactNode } from "react";

type ModalProviderProps = Readonly<{ children: ReactNode }>;

export function ModalProvider({ children }: ModalProviderProps) {
  return children;
}
