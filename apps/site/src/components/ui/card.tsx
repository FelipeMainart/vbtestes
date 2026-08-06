import type { ComponentProps } from "react";

export type CardProps = ComponentProps<"article">;

export function Card({ className, ...props }: CardProps) {
  const classes = ["ds-card", className].filter(Boolean).join(" ");

  return <article className={classes} {...props} />;
}
