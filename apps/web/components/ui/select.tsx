"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../icon";

type TriggerProps = Pick<
  ComponentProps<typeof SelectPrimitive.Trigger>,
  "id" | "className" | "aria-label" | "aria-labelledby"
>;

export function Select({
  children,
  name,
  value,
  onValueChange,
  ...triggerProps
}: TriggerProps & {
  children: ReactNode;
  name?: string;
  value: string | number;
  onValueChange: (value: string) => void;
}) {
  return (
    <SelectPrimitive.Root
      name={name}
      value={String(value)}
      onValueChange={onValueChange}
    >
      <SelectPrimitive.Trigger data-slot="select-trigger" {...triggerProps}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <Icon name="chevron-down" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          align="start"
          sideOffset={4}
          collisionPadding={8}
        >
          <SelectPrimitive.ScrollUpButton className="ui-select-scroll">
            <Icon name="chevron-down" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="ui-select-scroll">
            <Icon name="chevron-down" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectItem({
  children,
  value,
  ...props
}: Omit<ComponentProps<typeof SelectPrimitive.Item>, "value"> & {
  value: string | number;
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={String(value)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ui-select-indicator">
        <Icon name="check" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
