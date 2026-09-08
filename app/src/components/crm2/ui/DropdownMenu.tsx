"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Cf2DropdownMenu = DropdownMenuPrimitive.Root;
export const Cf2DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const Cf2DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const Cf2DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const Cf2DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const Cf2DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const Cf2DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[70] min-w-[10rem] overflow-hidden rounded-[var(--cf2-radius-md)] p-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      style={{
        background: "var(--cf2-bg-surface)",
        border: "1px solid var(--cf2-border-default)",
        boxShadow: "var(--cf2-shadow-card-md)",
      }}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
Cf2DropdownMenuContent.displayName = "Cf2DropdownMenuContent";

export const Cf2DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--cf2-radius-sm)] px-2 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--cf2-bg-surface-muted)]",
      className
    )}
    style={{ color: destructive ? "var(--cf2-danger-text)" : "var(--cf2-text-primary)" }}
    {...props}
  />
));
Cf2DropdownMenuItem.displayName = "Cf2DropdownMenuItem";

export const Cf2DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--cf2-radius-sm)] py-1.5 pl-7 pr-2 text-[13px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--cf2-bg-surface-muted)]",
      className
    )}
    style={{ color: "var(--cf2-text-primary)" }}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="size-3.5" style={{ color: "var(--cf2-accent-border)" }} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
Cf2DropdownMenuCheckboxItem.displayName = "Cf2DropdownMenuCheckboxItem";

export const Cf2DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--cf2-radius-sm)] py-1.5 pl-7 pr-2 text-[13px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--cf2-bg-surface-muted)]",
      className
    )}
    style={{ color: "var(--cf2-text-primary)" }}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="size-2 fill-current" style={{ color: "var(--cf2-accent-border)" }} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
Cf2DropdownMenuRadioItem.displayName = "Cf2DropdownMenuRadioItem";

export function Cf2DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide", className)}
      style={{ color: "var(--cf2-text-tertiary)" }}
      {...props}
    />
  );
}

export function Cf2DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px", className)}
      style={{ background: "var(--cf2-border-default)" }}
      {...props}
    />
  );
}

export const Cf2DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-[var(--cf2-radius-sm)] px-2 py-1.5 text-[13px] outline-none data-[state=open]:bg-[var(--cf2-bg-surface-muted)] data-[highlighted]:bg-[var(--cf2-bg-surface-muted)]",
      className
    )}
    style={{ color: "var(--cf2-text-primary)" }}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto size-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
Cf2DropdownMenuSubTrigger.displayName = "Cf2DropdownMenuSubTrigger";

export const Cf2DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-[70] min-w-[8rem] overflow-hidden rounded-[var(--cf2-radius-md)] p-1 data-[state=open]:animate-in data-[state=closed]:animate-out",
      className
    )}
    style={{
      background: "var(--cf2-bg-surface)",
      border: "1px solid var(--cf2-border-default)",
      boxShadow: "var(--cf2-shadow-card-md)",
    }}
    {...props}
  />
));
Cf2DropdownMenuSubContent.displayName = "Cf2DropdownMenuSubContent";
