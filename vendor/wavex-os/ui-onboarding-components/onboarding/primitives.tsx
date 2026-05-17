/**
 * Shared UI primitives used across onboarding pillars and phases.
 *
 * Kept dependency-light: only React + lucide + cn utility + shared button/card.
 * No business-logic imports here — primitives must be reusable in isolation.
 */

import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function RadioGroup({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition",
              value === opt.value
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-card hover:bg-accent",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChipMultiSelect({
  title,
  values,
  onToggle,
  options,
  max = 3,
}: {
  title: string;
  values: string[];
  onToggle: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  max?: number;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = values.includes(opt.value);
          const idx = selected ? values.indexOf(opt.value) + 1 : null;
          const capped = !selected && values.length >= max;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              disabled={capped}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition",
                selected
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : capped
                    ? "bg-muted/40 text-muted-foreground/50"
                    : "bg-card hover:bg-accent",
              )}
            >
              {idx !== null && <span className="mr-1 text-[9px] opacity-70">{idx}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {values.length} of {max} selected · first is your primary
      </div>
    </div>
  );
}

export function Pill({
  color,
  children,
}: {
  color: "emerald" | "amber" | "rose";
  children: React.ReactNode;
}) {
  const bg =
    color === "emerald"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : color === "amber"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-400";
  return <span className={cn("rounded px-2 py-0.5 text-[10px] font-medium", bg)}>{children}</span>;
}

export function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-mono font-semibold">{v}</span>
    </div>
  );
}

export function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-sm px-2 py-0.5",
        done
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : active
            ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
            : "bg-muted/40",
      )}
    >
      {label}
    </div>
  );
}
