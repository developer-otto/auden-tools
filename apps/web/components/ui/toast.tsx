"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import type { ReactNode } from "react";

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = ToastPrimitive.Viewport;

export function Toast({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className="toast visible"
      type="background"
      defaultOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ToastPrimitive.Description>{children}</ToastPrimitive.Description>
    </ToastPrimitive.Root>
  );
}
