"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de gaveta do CRM 2.0 sobre o `Sheet` do shadcn.
 *
 * Era a mesma composição do `sheet.tsx` da biblioteca, sobre o `Dialog` do
 * Radix, com `z-[70]` e borda inline. 1 consumidor, em `/negocios/:id`.
 *
 * O `z-[70]` sai junto: a gaveta lê `--z-modal` como o resto dos overlays da
 * biblioteca, e o menu que abre dentro dela fica acima por `--z-popover`.
 */

export const Cf2Sheet = Sheet;
export const Cf2SheetTrigger = SheetTrigger;
export const Cf2SheetClose = SheetClose;
export const Cf2SheetTitle = SheetTitle;
export const Cf2SheetDescription = SheetDescription;

export function Cf2SheetContent({ className, ...props }: React.ComponentProps<typeof SheetContent>) {
  return <SheetContent className={cn("gap-4 p-5", className)} {...props} />;
}

export function Cf2SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <SheetHeader className={cn("p-0", className)} {...props} />;
}

export function Cf2SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <SheetFooter className={cn("p-0", className)} {...props} />;
}
