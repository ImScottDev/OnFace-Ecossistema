"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils/cn";

export const Cf2Tabs = TabsPrimitive.Root;

export const Cf2TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex items-center gap-1 rounded-[var(--cf2-radius-md)] p-1", className)}
    style={{ background: "var(--cf2-bg-surface-muted)" }}
    {...props}
  />
));
Cf2TabsList.displayName = "Cf2TabsList";

export const Cf2TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-[var(--cf2-radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer data-[state=active]:shadow-sm data-[state=active]:bg-[var(--cf2-bg-surface)] data-[state=active]:text-[var(--cf2-text-primary)]",
      className
    )}
    style={{
      color: "var(--cf2-text-secondary)",
    }}
    {...props}
  />
));
Cf2TabsTrigger.displayName = "Cf2TabsTrigger";

export const Cf2TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-3 outline-none", className)} {...props} />
));
Cf2TabsContent.displayName = "Cf2TabsContent";
