import type { ComponentProps } from "react";

export function Badge(props: ComponentProps<"span">) {
  return <span data-slot="badge" {...props} />;
}
