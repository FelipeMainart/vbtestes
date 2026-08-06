import type { Metadata } from "next";

import { InstitutionalPage } from "@/features/institutional/presentation/components/institutional-page";
import { termsContent } from "@/features/institutional/presentation/content/institutional-content";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Consulte as condições para utilização responsável e segura do site Veste Bem.",
};

export default function TermsPage() {
  return <InstitutionalPage content={termsContent} />;
}
