import type { ComponentProps } from "react";

export function Card({
  as: Element = "div",
  className = "panel",
  ...props
}: ComponentProps<"div"> & { as?: "article" | "aside" | "div" | "section" }) {
  return <Element data-slot="card" className={className} {...props} />;
}
