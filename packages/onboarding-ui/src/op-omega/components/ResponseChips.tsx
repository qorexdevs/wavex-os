/** Unified chip primitive — replaces `<select>`, RadioGroup, and ChipMultiSelect
 *  across the onboarding shell. Supports single/multi selection plus an
 *  "Other → type your own" affordance for fields that need a free-text escape
 *  hatch.
 *
 *  Canonical and custom selections live in two separate arrays so parent code
 *  can map them onto the existing schema cleanly (either `_other` sibling
 *  fields like Pillar 3-5, or "replace the enum with the typed string" like
 *  Pillar 1's industry_hint). The component owns no serialization. */

import { useRef, useState, type KeyboardEvent } from "react";

export interface ResponseChipOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface ResponseChipsProps<T extends string> {
  options: ReadonlyArray<ResponseChipOption<T>>;
  mode: "single" | "multi";
  values: T[];
  customValues?: string[];
  allowCustom?: boolean;
  /** Max total chips in multi mode (canonical + custom). Ignored in single mode. */
  maxSelections?: number;
  customLabel?: string;
  onChange: (next: T[]) => void;
  onCustomChange?: (next: string[]) => void;
  disabled?: boolean;
}

export function ResponseChips<T extends string>({
  options,
  mode,
  values,
  customValues = [],
  allowCustom = false,
  maxSelections,
  customLabel = "Other",
  onChange,
  onCustomChange,
  disabled = false,
}: ResponseChipsProps<T>) {
  const [editingCustom, setEditingCustom] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const totalSelected = values.length + customValues.length;
  const atLimit =
    mode === "multi" && typeof maxSelections === "number" && totalSelected >= maxSelections;

  function toggleCanonical(v: T) {
    if (disabled) return;
    if (mode === "single") {
      // Click the already-active option to deselect (clears the field —
      // parent's submit gate will disable Continue until something is picked).
      if (values[0] === v && customValues.length === 0) {
        onChange([]);
        return;
      }
      onChange([v]);
      if (customValues.length > 0) onCustomChange?.([]);
      return;
    }
    const isActive = values.includes(v);
    if (isActive) {
      onChange(values.filter((x) => x !== v));
    } else {
      if (atLimit) return;
      onChange([...values, v]);
    }
  }

  function commitCustom() {
    const trimmed = draft.trim();
    setDraft("");
    setEditingCustom(false);
    if (!trimmed) return;
    if (!onCustomChange) return;
    if (mode === "single") {
      if (values.length > 0) onChange([]);
      onCustomChange([trimmed]);
      return;
    }
    if (customValues.includes(trimmed)) return;
    if (atLimit) return;
    onCustomChange([...customValues, trimmed]);
  }

  function removeCustom(s: string) {
    if (!onCustomChange) return;
    onCustomChange(customValues.filter((x) => x !== s));
  }

  function handleInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCustom();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
      setEditingCustom(false);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggleCanonical(o.value)}
            disabled={disabled || (!active && atLimit)}
            title={o.description}
            style={{
              padding: "0.4rem 0.7rem",
              fontSize: 12,
              borderRadius: 999,
              cursor: disabled || (!active && atLimit) ? "not-allowed" : "pointer",
              border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: active ? "var(--surface-2)" : "transparent",
              color: "var(--text)",
              opacity: !active && atLimit ? 0.5 : 1,
            }}
          >
            {active ? "✓ " : ""}{o.label}
          </button>
        );
      })}

      {customValues.map((s) => (
        <span
          key={`custom:${s}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.4rem 0.7rem",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid var(--accent)",
            background: "var(--surface-2)",
            color: "var(--text)",
          }}
        >
          <span style={{ color: "var(--text-dim)" }}>✎</span>
          {s}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeCustom(s)}
              aria-label={`Remove ${s}`}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                fontSize: 14,
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {allowCustom && !editingCustom && (
        <button
          type="button"
          onClick={() => {
            setEditingCustom(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          disabled={disabled || atLimit}
          style={{
            padding: "0.4rem 0.7rem",
            fontSize: 12,
            borderRadius: 999,
            cursor: disabled || atLimit ? "not-allowed" : "pointer",
            border: "1px dashed var(--border)",
            background: "transparent",
            color: "var(--text-dim)",
            opacity: atLimit ? 0.5 : 1,
          }}
        >
          + {customLabel}
        </button>
      )}

      {allowCustom && editingCustom && (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleInputKey}
          onBlur={commitCustom}
          placeholder="Type and press Enter…"
          style={{
            padding: "0.35rem 0.7rem",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid var(--accent)",
            background: "var(--surface-2)",
            color: "var(--text)",
            outline: "none",
            minWidth: 180,
          }}
        />
      )}
    </div>
  );
}
