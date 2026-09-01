"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils/cn";

export const Cf2TooltipProvider = TooltipPrimitive.Provider;
export const Cf2Tooltip = TooltipPrimitive.Root;
export const Cf2TooltipTrigger = TooltipPrimitive.Trigger;

export const Cf2TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[70] rounded-[var(--cf2-radius-sm)] px-2.5 py-1.5 text-xs data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95",
        className
      )}
      style={{
        background: "var(--cf2-bg-inverse)",
        color: "var(--cf2-text-on-inverse)",
      }}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
Cf2TooltipContent.displayName = "Cf2TooltipContent";
