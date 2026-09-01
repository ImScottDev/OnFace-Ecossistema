"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Cf2Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn("flex h-full w-full flex-col overflow-hidden rounded-[var(--cf2-radius-lg)]", className)}
    style={{ background: "var(--cf2-bg-surface)" }}
    {...props}
  />
));
Cf2Command.displayName = "Cf2Command";

export function Cf2CommandDialog({
  children,
  shouldFilter,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & { shouldFilter?: boolean }) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[20%] z-[70] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-[var(--cf2-radius-lg)] outline-none"
          style={{ background: "var(--cf2-bg-surface)", boxShadow: "var(--cf2-shadow-card-md)", border: "1px solid var(--cf2-border-default)" }}
        >
          <DialogPrimitive.Title className="sr-only">Busca rápida</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Busque comandos, telas e registros do CRM
          </DialogPrimitive.Description>
          <Cf2Command shouldFilter={shouldFilter}>{children}</Cf2Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const Cf2CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 px-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
    <Search className="size-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full bg-transparent text-sm outline-none placeholder:text-[var(--cf2-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{ color: "var(--cf2-text-primary)" }}
      {...props}
    />
  </div>
));
Cf2CommandInput.displayName = "Cf2CommandInput";

export const Cf2CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} className={cn("max-h-80 overflow-y-auto overflow-x-hidden p-1", className)} {...props} />
));
Cf2CommandList.displayName = "Cf2CommandList";

export const Cf2CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-8 text-center text-sm" style={{ color: "var(--cf2-text-tertiary)" }} {...props} />
));
Cf2CommandEmpty.displayName = "Cf2CommandEmpty";

export const Cf2CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide",
      className
    )}
    style={{ color: "var(--cf2-text-primary)" }}
    {...props}
  />
));
Cf2CommandGroup.displayName = "Cf2CommandGroup";

export const Cf2CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--cf2-radius-sm)] px-2 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-[var(--cf2-bg-surface-muted)]",
      className
    )}
    style={{ color: "var(--cf2-text-primary)" }}
    {...props}
  />
));
Cf2CommandItem.displayName = "Cf2CommandItem";

export function Cf2CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator className={cn("-mx-1 my-1 h-px", className)} style={{ background: "var(--cf2-border-default)" }} {...props} />
  );
}
