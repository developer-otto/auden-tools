"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetTitle = DialogPrimitive.Title;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent(
  props: ComponentProps<typeof DialogPrimitive.Content>,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" />
      <DialogPrimitive.Content data-slot="sheet-content" {...props} />
    </DialogPrimitive.Portal>
  );
}
