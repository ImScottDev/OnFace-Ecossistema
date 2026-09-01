"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils/cn";

const fieldBase =
  "w-full rounded-[var(--cf2-radius-sm)] text-sm px-3 py-2 outline-none transition-colors placeholder:text-[var(--cf2-text-tertiary)] focus:border-[var(--cf2-accent-border)] disabled:opacity-50 disabled:cursor-not-allowed";

const fieldStyle: React.CSSProperties = {
  background: "var(--cf2-bg-surface)",
  color: "var(--cf2-text-primary)",
  border: "1px solid var(--cf2-border-default)",
};

export const Cf2Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, style, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} style={{ ...fieldStyle, ...style }} {...props} />
  )
);
Cf2Input.displayName = "Cf2Input";

export const Cf2Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, style, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "min-h-20 resize-y", className)} style={{ ...fieldStyle, ...style }} {...props} />
  )
);
Cf2Textarea.displayName = "Cf2Textarea";

export const Cf2Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, style, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-[13px] font-medium", className)}
    style={{ color: "var(--cf2-text-secondary)", ...style }}
    {...props}
  />
));
Cf2Label.displayName = "Cf2Label";
