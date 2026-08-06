import type { ComponentProps, ElementType, ReactNode } from "react";

type ContainerProps<TElement extends ElementType = "div"> = {
  as?: TElement;
  children: ReactNode;
} & Omit<ComponentProps<TElement>, "as" | "children">;

export function Container<TElement extends ElementType = "div">({
  as,
  children,
  ...props
}: ContainerProps<TElement>) {
  const Component = as ?? "div";

  return <Component {...props}>{children}</Component>;
}
