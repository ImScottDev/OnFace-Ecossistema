"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-10 px-4 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

function variantStyle(variant: Variant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" };
    case "secondary":
      return {
        background: "var(--cf2-bg-surface)",
        color: "var(--cf2-text-primary)",
        border: "1px solid var(--cf2-border-default)",
      };
    case "danger":
      return {
        background: "transparent",
        color: "var(--cf2-danger-text)",
        border: "1px solid var(--cf2-danger-border)",
      };
    case "ghost":
    default:
      return { background: "transparent", color: "var(--cf2-text-primary)" };
  }
}

export interface Cf2ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
}

export const Cf2Button = React.forwardRef<HTMLButtonElement, Cf2ButtonProps>(
  ({ variant = "primary", size = "md", loading, asChild, className, style, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--cf2-radius-md)] font-medium whitespace-nowrap transition-colors cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none hover:brightness-95 active:brightness-90",
          SIZE_CLASS[size],
          className
        )}
        style={{ ...variantStyle(variant), ...style }}
        disabled={asChild ? undefined : disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Cf2Button.displayName = "Cf2Button";
