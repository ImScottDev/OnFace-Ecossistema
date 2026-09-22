"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Cf2Select = SelectPrimitive.Root;
export const Cf2SelectGroup = SelectPrimitive.Group;
export const Cf2SelectValue = SelectPrimitive.Value;

export const Cf2SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, style, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between gap-2 rounded-[var(--cf2-radius-sm)] px-3 text-sm outline-none transition-colors data-[placeholder]:text-[var(--cf2-text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
      className
    )}
    style={{
      background: "var(--cf2-bg-surface)",
      color: "var(--cf2-text-primary)",
      border: "1px solid var(--cf2-border-default)",
      ...style,
    }}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
Cf2SelectTrigger.displayName = "Cf2SelectTrigger";

export const Cf2SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", style, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-[70] max-h-80 min-w-[8rem] overflow-hidden rounded-[var(--cf2-radius-md)] p-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className
      )}
      style={{
        background: "var(--cf2-bg-surface)",
        border: "1px solid var(--cf2-border-default)",
        boxShadow: "var(--cf2-shadow-card-md)",
        ...style,
      }}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]")}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
Cf2SelectContent.displayName = "Cf2SelectContent";

export const Cf2SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, style, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-[var(--cf2-radius-sm)] py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--cf2-bg-surface-muted)]",
      className
    )}
    style={{ color: "var(--cf2-text-primary)", ...style }}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
      <Check className="size-4" style={{ color: "var(--cf2-accent-text)" }} />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
Cf2SelectItem.displayName = "Cf2SelectItem";
