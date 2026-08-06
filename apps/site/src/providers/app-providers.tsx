import type { ReactNode } from "react";

import { ModalProvider } from "./modal-provider";
import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "./toast-provider";

type AppProvidersProps = Readonly<{
  children: ReactNode;
}>;

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ModalProvider>{children}</ModalProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
