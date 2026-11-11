import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

export function Button({
  asChild,
  type = "button",
  ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
  if (asChild) return <Slot data-slot="button" {...props} />;
  return <button data-slot="button" type={type} {...props} />;
}
