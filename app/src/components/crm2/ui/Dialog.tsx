"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Cf2Dialog = DialogPrimitive.Root;
export const Cf2DialogTrigger = DialogPrimitive.Trigger;
export const Cf2DialogClose = DialogPrimitive.Close;

export function Cf2DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.DialogContentProps & { showCloseButton?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--cf2-radius-lg)] p-6 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        style={{
          background: "var(--cf2-bg-surface)",
          boxShadow: "var(--cf2-shadow-card-md)",
          border: "1px solid var(--cf2-border-default)",
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-[var(--cf2-radius-sm)] p-1 opacity-70 transition-opacity hover:opacity-100 cursor-pointer"
            style={{ color: "var(--cf2-text-secondary)" }}
          >
            <X className="size-4" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function Cf2DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />;
}

export function Cf2DialogTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold", className)}
      style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}
      {...props}
    />
  );
}

export function Cf2DialogDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn("text-[13px]", className)}
      style={{ color: "var(--cf2-text-secondary)" }}
      {...props}
    />
  );
}

export function Cf2DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-end gap-2 mt-6", className)} {...props} />;
}
