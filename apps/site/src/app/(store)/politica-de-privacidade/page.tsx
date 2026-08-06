import type { Metadata } from "next";

import { InstitutionalPage } from "@/features/institutional/presentation/components/institutional-page";
import { privacyContent } from "@/features/institutional/presentation/content/institutional-content";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Entenda como a Veste Bem coleta, utiliza e protege dados pessoais conforme a LGPD.",
};

export default function PrivacyPolicyPage() {
  return <InstitutionalPage content={privacyContent} />;
}
