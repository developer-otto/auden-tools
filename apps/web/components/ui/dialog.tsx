"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent(
  props: ComponentProps<typeof DialogPrimitive.Content>,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" />
      <DialogPrimitive.Content data-slot="dialog-content" {...props} />
    </DialogPrimitive.Portal>
  );
}
