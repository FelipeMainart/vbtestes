export type HomeAction = Readonly<{
  href: string;
  label: string;
}>;

export type HomeContent = Readonly<{
  benefits: Readonly<{
    items: readonly Readonly<{
      description: string;
      id: string;
      title: string;
    }>[];
    title: string;
  }>;
  faq: Readonly<{
    items: readonly Readonly<{
      answer: string;
      id: string;
      question: string;
    }>[];
    title: string;
  }>;
  featuredProducts: Readonly<{
    description: string;
    eyebrow: string;
    title: string;
  }>;
  hero: Readonly<{
    description: string;
    eyebrow: string;
    indicators: readonly string[];
    mediaLabel: string;
    primaryAction: HomeAction;
    secondaryAction: HomeAction;
    title: string;
  }>;
  howItWorks: Readonly<{
    steps: readonly Readonly<{
      description: string;
      id: string;
      title: string;
    }>[];
    description: string;
    title: string;
  }>;
}>;
