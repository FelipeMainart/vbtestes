import type { ReactNode } from "react";

type ToastProviderProps = Readonly<{ children: ReactNode }>;

export function ToastProvider({ children }: ToastProviderProps) {
  return children;
}
