"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
};

export function QuantityStepper({ value, min = 1, max, onChange, className }: QuantityStepperProps) {
  const canDecrease = value > min;
  const canIncrease = max === undefined || value < max;

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2", className)}>
      <button
        type="button"
        onClick={() => canDecrease && onChange(value - 1)}
        disabled={!canDecrease}
        className="grid h-8 w-8 place-items-center rounded-full text-foreground/70 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Reducir cantidad"
      >
        <Minus size={16} />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold">{value}</span>
      <button
        type="button"
        onClick={() => canIncrease && onChange(value + 1)}
        disabled={!canIncrease}
        className="grid h-8 w-8 place-items-center rounded-full text-foreground/70 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Aumentar cantidad"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}