"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Cf2Sheet = DialogPrimitive.Root;
export const Cf2SheetTrigger = DialogPrimitive.Trigger;
export const Cf2SheetClose = DialogPrimitive.Close;

type Side = "top" | "right" | "bottom" | "left";

const SIDE_CLASS: Record<Side, string> = {
  right: "inset-y-0 right-0 h-full w-full sm:w-[420px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  left: "inset-y-0 left-0 h-full w-full sm:w-[420px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  top: "inset-x-0 top-0 w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  bottom: "inset-x-0 bottom-0 w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
};

const SIDE_BORDER: Record<Side, React.CSSProperties> = {
  right: { borderLeft: "1px solid var(--cf2-border-default)" },
  left: { borderRight: "1px solid var(--cf2-border-default)" },
  top: { borderBottom: "1px solid var(--cf2-border-default)" },
  bottom: { borderTop: "1px solid var(--cf2-border-default)" },
};

export function Cf2SheetContent({
  side = "right",
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.DialogContentProps & { side?: Side; showCloseButton?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn("fixed z-[70] flex flex-col gap-4 p-5 outline-none", SIDE_CLASS[side], className)}
        style={{
          background: "var(--cf2-bg-surface)",
          boxShadow: "var(--cf2-shadow-shell)",
          ...SIDE_BORDER[side],
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

export function Cf2SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function Cf2SheetTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold", className)}
      style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}
      {...props}
    />
  );
}

export function Cf2SheetDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn("text-[13px]", className)}
      style={{ color: "var(--cf2-text-secondary)" }}
      {...props}
    />
  );
}

export function Cf2SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex items-center justify-end gap-2 pt-4", className)} style={{ borderTop: "1px solid var(--cf2-border-default)" }} {...props} />;
}
