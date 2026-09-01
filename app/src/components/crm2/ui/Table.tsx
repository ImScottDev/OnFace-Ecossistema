"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Cf2Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm border-collapse", className)} {...props} />
    </div>
  );
}

export function Cf2TableHeader({ className, style, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("[&_tr]:border-b", className)}
      style={{ borderColor: "var(--cf2-border-default)", ...style }}
      {...props}
    />
  );
}

export function Cf2TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function Cf2TableRow({ className, style, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b transition-colors hover:bg-[var(--cf2-bg-surface-muted)]", className)}
      style={{ borderColor: "var(--cf2-border-default)", ...style }}
      {...props}
    />
  );
}

export function Cf2TableHead({ className, style, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn("h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap", className)}
      style={{ color: "var(--cf2-text-secondary)", ...style }}
      {...props}
    />
  );
}

export function Cf2TableCell({ className, style, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("px-3 py-2.5 align-middle", className)}
      style={{ color: "var(--cf2-text-primary)", ...style }}
      {...props}
    />
  );
}
