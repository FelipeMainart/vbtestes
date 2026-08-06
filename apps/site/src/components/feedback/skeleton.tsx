import type { ComponentProps } from "react";

export type SkeletonProps = ComponentProps<"div">;

export function Skeleton({ className, ...props }: SkeletonProps) {
  const classes = ["ds-skeleton", className].filter(Boolean).join(" ");

  return <div aria-hidden="true" className={classes} {...props} />;
}
