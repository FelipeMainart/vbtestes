import type { ReactNode } from "react";

type EmptyStateProps = Readonly<{
  action?: ReactNode;
  description: string;
  title: string;
}>;

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <section className="ds-empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
