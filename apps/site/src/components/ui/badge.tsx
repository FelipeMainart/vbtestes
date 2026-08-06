import type { ComponentProps } from "react";

type BadgeVariant = "active" | "inactive" | "low-stock" | "out-of-stock";

export type BadgeProps = ComponentProps<"span"> & {
  variant: BadgeVariant;
};

export function Badge({ className, variant, ...props }: BadgeProps) {
  const classes = ["ds-badge", `ds-badge--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} {...props} />;
}
