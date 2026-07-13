import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-gradient-to-r from-primary to-accent text-white shadow-[0_16px_30px_rgba(29,155,240,0.20)] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(29,155,240,0.28)]",
        variant === "secondary" && "border border-border bg-white/80 hover:bg-muted/70 dark:bg-slate-900/70",
        variant === "ghost" && "hover:bg-muted/70",
        className
      )}
      {...props}
    />
  );
}