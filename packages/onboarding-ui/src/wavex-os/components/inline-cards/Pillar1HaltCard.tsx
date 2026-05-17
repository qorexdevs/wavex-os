/** Inline halt-recovery card for Pillar 1.
 *
 *  When the URL/repo enrichment can't produce something useful (taxonomy
 *  empty, fetch failed, terse response), the route returns HTTP 409 with an
 *  operator-friendly message. This card lets the operator describe their
 *  product in their own words. The text is re-submitted to Pillar 1 via the
 *  manual_context field, which short-circuits the T2 deep-dive and uses the
 *  prose verbatim as company_context. */

import { useState } from "react";
import type { Pillar1Response } from "@wavex-os/plugin-onboarding";
import { wavexOsOnboardingApi, ApiError } from "../../lib/api";

const MIN_CHARS = 40;

interface Props {
  companyId: string;
  orgName: string;
  rawInput: string;
  onRecovered: (response: Pillar1Response) => void;
}

export function Pillar1HaltCard({ companyId, orgName, rawInput, onRecovered }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState<"none" | "retry" | "manual">("none");
  const [error, setError] = useState<string | null>(null);
  const tooShort = text.trim().length < MIN_CHARS;

  async function handleResubmit(): Promise<void> {
    setSubmitting("manual");
    setError(null);
    try {
      const result = await wavexOsOnboardingApi.pillar1({
        companyId,
        org_name: orgName,
        raw_input: rawInput,
        manual_context: text.trim(),
      });
      onRecovered(result.response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting("none");
    }
  }

  async function handleRetry(): Promise<void> {
    setSubmitting("retry");
    setError(null);
    try {
      const result = await wavexOsOnboardingApi.pillar1({
        companyId,
        org_name: orgName,
        raw_input: rawInput,
      });
      onRecovered(result.response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting("none");
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={submitting !== "none"}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
            fontSize: 11,
            cursor: submitting !== "none" ? "not-allowed" : "pointer",
          }}
        >
          {submitting === "retry" ? "Retrying…" : "↻ Retry with same input"}
        </button>
        <span className="text-dim" style={{ fontSize: 11 }}>
          or describe it below ↓
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={submitting !== "none"}
        placeholder={`Tell me what you're building (≥${MIN_CHARS} characters). Mention the customer, the product, and what's working / not yet working.`}
        style={{
          width: "100%",
          padding: "0.55rem 0.7rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
          fontSize: 13,
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="text-dim" style={{ fontSize: 11 }}>
          {text.trim().length} / {MIN_CHARS} chars
        </span>
        <button
          type="button"
          onClick={() => void handleResubmit()}
          disabled={submitting !== "none" || tooShort}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: submitting !== "none" || tooShort ? "not-allowed" : "pointer",
            opacity: submitting !== "none" || tooShort ? 0.6 : 1,
          }}
        >
          {submitting === "manual" ? "Working…" : "Continue with this →"}
        </button>
      </div>
      {error && (
        <div style={{ color: "var(--warning)", fontSize: 12 }}>
          ✗ {error}
        </div>
      )}
    </div>
  );
}
