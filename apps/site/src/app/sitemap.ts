import type { MetadataRoute } from "next";

import { ROUTES } from "@/constants/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (!siteUrl) return [];

  const pages = [
    { changeFrequency: "weekly", path: ROUTES.home, priority: 1 },
    { changeFrequency: "monthly", path: ROUTES.about, priority: 0.7 },
    {
      changeFrequency: "monthly",
      path: ROUTES.purchasePolicy,
      priority: 0.5,
    },
    {
      changeFrequency: "yearly",
      path: ROUTES.privacyPolicy,
      priority: 0.4,
    },
    { changeFrequency: "monthly", path: ROUTES.delivery, priority: 0.5 },
    { changeFrequency: "yearly", path: ROUTES.terms, priority: 0.4 },
    { changeFrequency: "weekly", path: ROUTES.tracking, priority: 0.6 },
  ] as const;

  return pages.map((page) => ({
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    url: `${siteUrl}${page.path}`,
  }));
}
