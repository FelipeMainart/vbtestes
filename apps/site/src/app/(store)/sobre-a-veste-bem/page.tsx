import type { Metadata } from "next";

import { InstitutionalPage } from "@/features/institutional/presentation/components/institutional-page";
import { aboutContent } from "@/features/institutional/presentation/content/institutional-content";

export const metadata: Metadata = {
  title: "Sobre a Veste Bem",
  description:
    "Conheça a Veste Bem, marca de fabricação própria especializada em coletes femininos de alfaiataria no modelo atacarejo.",
};

export default function AboutPage() {
  return <InstitutionalPage content={aboutContent} />;
}
