"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { ComponentProps } from "react";

export function Toggle(props: ComponentProps<typeof TogglePrimitive.Root>) {
  return <TogglePrimitive.Root data-slot="toggle" {...props} />;
}

export function ToggleGroup(
  props: ComponentProps<typeof ToggleGroupPrimitive.Root>,
) {
  return <ToggleGroupPrimitive.Root data-slot="toggle-group" {...props} />;
}

export function ToggleGroupItem(
  props: ComponentProps<typeof ToggleGroupPrimitive.Item>,
) {
  return <ToggleGroupPrimitive.Item data-slot="toggle-group-item" {...props} />;
}
