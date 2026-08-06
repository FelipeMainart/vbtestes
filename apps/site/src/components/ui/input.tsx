import type { ComponentProps } from "react";

export type InputProps = ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  const classes = ["ds-input", className].filter(Boolean).join(" ");

  return <input className={classes} {...props} />;
}
