/** Inline scope picker — asks whether the operator wants a full AI org
 *  or a focused team (marketing + sales, ops only, etc.). Pre-selects
 *  chips based on keyword detection from Pillar 1's raw_input so a
 *  prompt like "marketing and sales for my SaaS" lands with both
 *  departments already chipped. */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";
import { ResponseChips } from "../ResponseChips";
import { ALL_DEPARTMENTS, DEPARTMENT_LABEL, type Department } from "../../lib/scope-detect";

const MODE_OPTIONS = [
  { value: "full", label: "Full company (33+ agents)" },
  { value: "focused", label: "Focused on specific divisions" },
];

const DEPT_OPTIONS = ALL_DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] }));

interface Props {
  companyId: string;
  detected: Department[];
  onDone: (mode: "full" | "focused", departments: Department[]) => void;
}

export function ScopePromptCard({ companyId, detected, onDone }: Props) {
  // If we detected divisions from the raw_input, default to focused mode +
  // pre-select those departments. Otherwise default to full.
  const [mode, setMode] = useState<string[]>([detected.length > 0 ? "focused" : "full"]);
  const [depts, setDepts] = useState<string[]>(detected);
  const [customDepts, setCustomDepts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFocused = mode[0] === "focused";
  const ready = !isFocused || depts.length + customDepts.length > 0;

  async function handleSubmit(): Promise<void> {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.setScope({
        companyId,
        mode: isFocused ? "focused" : "full",
        departments: isFocused ? (depts as Department[]) : [],
        custom_labels: isFocused && customDepts.length > 0 ? customDepts : undefined,
      });
      onDone(isFocused ? "focused" : "full", isFocused ? (depts as Department[]) : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {detected.length > 0 && (
        <div className="text-dim" style={{ fontSize: 11, lineHeight: 1.5 }}>
          I picked up <strong>{detected.map((d) => DEPARTMENT_LABEL[d]).join(" + ")}</strong> from what you wrote — adjust below.
        </div>
      )}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
          Scope
        </div>
        <ResponseChips
          mode="single"
          options={MODE_OPTIONS}
          values={mode}
          onChange={setMode}
          disabled={submitting}
        />
      </div>

      {isFocused && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
            Which divisions?
          </div>
          <ResponseChips
            mode="multi"
            options={DEPT_OPTIONS}
            values={depts}
            customValues={customDepts}
            allowCustom
            customLabel="Other division"
            onChange={setDepts}
            onCustomChange={setCustomDepts}
            disabled={submitting}
          />
          <div className="text-dim" style={{ fontSize: 10, marginTop: "0.45rem", lineHeight: 1.5 }}>
            Non-selected divisions get parked and can be activated later from Mission Control.
            CEO + Chief of Staff always stay active. Custom divisions without a canonical
            chip default to Operations until dedicated templates ship.
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !ready}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: submitting || !ready ? "not-allowed" : "pointer",
            opacity: submitting || !ready ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
