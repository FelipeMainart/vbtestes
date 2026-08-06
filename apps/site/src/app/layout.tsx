import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_CONFIG } from "@/config/app.config";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.name,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang={APP_CONFIG.locale}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
