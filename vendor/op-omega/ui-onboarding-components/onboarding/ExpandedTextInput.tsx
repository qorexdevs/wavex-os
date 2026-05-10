/**
 * Shared textarea + character counter for `Other — specify` fields.
 *
 * All six "Other" fields across pillars 3/4/5 use this component, so the
 * 40–500 character contract + counter UI is consistent (Sprint 002 · Issue 1).
 */

import { useState, useEffect } from "react";

export interface ExpandedTextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  /** Disables parent submit button when minLength not met. Parent reads this. */
  onValidChange?: (valid: boolean) => void;
}

export function ExpandedTextInput({
  value,
  onChange,
  placeholder,
  minLength = 40,
  maxLength = 500,
  rows = 3,
  onValidChange,
}: ExpandedTextInputProps) {
  const [touched, setTouched] = useState(false);
  const len = value.trim().length;
  const tooShort = len < minLength;
  const tooLong = len > maxLength;
  const valid = !tooShort && !tooLong;

  useEffect(() => {
    onValidChange?.(valid);
  }, [valid, onValidChange]);

  return (
    <div className="space-y-1">
      <textarea
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${touched && tooShort ? "border-amber-500/60" : ""}`}
        rows={rows}
        value={value}
        onChange={(e) => { onChange(e.target.value); setTouched(true); }}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      <div className={`flex justify-between text-[10px] ${tooShort || tooLong ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
        <span>
          {len} / {minLength} minimum characters
          {tooLong && <span className="ml-2">· {len - maxLength} over max</span>}
        </span>
      </div>
    </div>
  );
}
