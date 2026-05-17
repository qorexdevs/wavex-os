/** Wavex-os-style UI primitives — small reusable components that match
 * the wavex-os dark theme (var(--accent), var(--surface), etc.). */

import { useState, type ReactNode } from "react";

export function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: "0.5rem" }}>{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-dim" style={{ fontSize: 15, marginBottom: "1.5rem" }}>{children}</p>;
}

export function Card({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <div className="card" style={accent ? { borderColor: "var(--accent)" } : undefined}>
      {children}
    </div>
  );
}

export function Field({ label, hint, required, children }: {
  label: ReactNode; hint?: string; required?: boolean; children: ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: "1.25rem" }}>
      <div style={{ marginBottom: "0.5rem" }}>
        {label}
        {required && <span style={{ color: "var(--warning)", marginLeft: "0.4rem", fontSize: 12 }}>*</span>}
        {hint && <span className="text-dim" style={{ fontSize: 12, marginLeft: "0.4rem" }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function RadioGroup<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; description?: string }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            type="button"
            style={{
              textAlign: "left",
              padding: "0.6rem 0.75rem",
              fontSize: 13,
              cursor: "pointer",
              border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: active ? "var(--surface-2)" : "transparent",
              color: "var(--text)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <span style={{ fontWeight: 600 }}>{o.label}</span>
            {o.description && <span className="text-dim" style={{ fontSize: 11 }}>{o.description}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ChipMultiSelect<T extends string>({ values, onChange, options }: {
  values: T[];
  onChange: (next: T[]) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const toggle = (v: T) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            type="button"
            style={{
              padding: "0.4rem 0.7rem",
              fontSize: 12,
              borderRadius: 999,
              cursor: "pointer",
              border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: active ? "var(--surface-2)" : "transparent",
              color: "var(--text)",
            }}
          >
            {active ? "✓ " : ""}{o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-form chip input — operator types a value, hits Enter/comma to add
 *  a chip, clicks × to remove. Distinct from ChipMultiSelect which is for
 *  fixed option sets. Used by the per-tool drawer (VIPs, privacy zones)
 *  and the Voice step (guardrails). */
export function ChipInput({
  values, onChange, placeholder, max = 20, ariaLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string>("");
  function add(raw: string): void {
    const v = raw.trim().replace(/,$/, "").trim();
    if (!v) return;
    if (values.includes(v)) { setDraft(""); return; }
    if (values.length >= max) return;
    onChange([...values, v]);
    setDraft("");
  }
  function remove(idx: number): void {
    onChange(values.filter((_, i) => i !== idx));
  }
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: "0.35rem",
        padding: "0.4rem 0.5rem",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        minHeight: 36,
      }}
      onClick={(e) => {
        const tgt = e.currentTarget.querySelector("input");
        if (tgt instanceof HTMLInputElement) tgt.focus();
      }}
    >
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.25rem",
            padding: "0.15rem 0.5rem",
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            color: "var(--accent)",
            border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
            borderRadius: 999, fontSize: 11, fontWeight: 600,
          }}
        >
          {v}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(i); }}
            aria-label={`Remove ${v}`}
            style={{
              background: "transparent", border: "none", color: "var(--accent)",
              cursor: "pointer", padding: 0, marginLeft: 2, fontSize: 13, lineHeight: 1,
            }}
          >×</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        placeholder={values.length === 0 ? placeholder : ""}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
            remove(values.length - 1);
          }
        }}
        onBlur={() => { if (draft.trim()) add(draft); }}
        style={{
          flex: 1, minWidth: 80,
          background: "transparent", border: "none", outline: "none",
          color: "var(--text)", fontSize: 12, fontFamily: "inherit",
        }}
      />
    </div>
  );
}

export function NavRow({ back, next, nextLabel, nextDisabled, onNext }: {
  back?: { onClick?: () => void; label?: string };
  next?: { onClick?: () => void; label?: string };
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void;
}) {
  return (
    <div className="nav-buttons">
      {back ? (
        <button className="secondary" onClick={back.onClick} type="button">{back.label ?? "← Back"}</button>
      ) : <span />}
      {next || onNext ? (
        <button onClick={next?.onClick ?? onNext} disabled={nextDisabled} type="button">
          {next?.label ?? nextLabel ?? "Next →"}
        </button>
      ) : <span />}
    </div>
  );
}
