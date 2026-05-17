/** Step 3 of the Avatar branch — captures 3 voice/style samples that the
 *  server feeds to T2 to build a voice profile (tone, formality, structure,
 *  delegation hints). Under ?t0=1 the server returns a deterministic stub
 *  so the walk completes without spending tokens. */

import { useEffect, useRef, useState } from "react";
import { wavexOsOnboardingApi, ApiError } from "../../lib/api";
import { T2ProgressIndicator } from "../T2ProgressIndicator";
import { ChipInput } from "../primitives";
import { isT0FastMode } from "../../lib/dev-flags";
import type { AvatarVoiceProfile } from "../../state/onboarding-reducer";

interface Props {
  avatarId: string;
  onAnalyzing: () => void;
  onDone: (profile: AvatarVoiceProfile) => void;
}

const PROMPTS = [
  "Paste a recent email you wrote to a customer or colleague.",
  "How do you take notes? Paste a recent meeting note or todo list.",
  "What's the first task you'd hand off if you had a clone?",
];

const MIN_LEN = 20;

export function AvatarVoiceCard({ avatarId, onAnalyzing, onDone }: Props) {
  const [samples, setSamples] = useState<[string, string, string]>(["", "", ""]);
  const [signoff, setSignoff] = useState<string>("");
  const [guardrails, setGuardrails] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = [useRef<HTMLTextAreaElement | null>(null), useRef<HTMLTextAreaElement | null>(null), useRef<HTMLTextAreaElement | null>(null)];

  useEffect(() => { refs[0].current?.focus(); }, []);

  function update(idx: 0 | 1 | 2, text: string): void {
    setSamples((prev) => {
      const next: [string, string, string] = [...prev] as [string, string, string];
      next[idx] = text;
      return next;
    });
  }

  // Progressive disclosure: each prompt reveals only after the previous has
  // at least MIN_LEN chars. Lower friction than showing all three at once.
  const visibleCount = (() => {
    if (samples[0].trim().length < MIN_LEN) return 1;
    if (samples[1].trim().length < MIN_LEN) return 2;
    return 3;
  })();

  const ready = samples.every((s) => s.trim().length >= MIN_LEN);

  async function submit(): Promise<void> {
    setAnalyzing(true);
    onAnalyzing();
    setError(null);
    try {
      const r = await wavexOsOnboardingApi.analyzeAvatarVoice(
        avatarId, samples, isT0FastMode(),
        { signoff: signoff.trim() || undefined, guardrails: guardrails.length > 0 ? guardrails : undefined },
      );
      onDone(r.profile);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div className="text-dim" style={{ fontSize: 12 }}>
        Show me how you write. Three short prompts — your avatar uses them to
        mirror your voice.
      </div>

      {analyzing && (
        <T2ProgressIndicator active phase="avatar-voice" />
      )}

      {PROMPTS.slice(0, visibleCount).map((prompt, idx) => (
        <div key={idx}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-dim)" }}>
            {idx + 1}. {prompt}
          </div>
          <textarea
            ref={refs[idx]}
            value={samples[idx]}
            onChange={(e) => update(idx as 0 | 1 | 2, e.target.value)}
            placeholder="Paste here…"
            disabled={analyzing}
            rows={3}
            style={{
              width: "100%",
              padding: "0.5rem 0.65rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "inherit",
              lineHeight: 1.5,
              outline: "none",
              resize: "vertical",
              minHeight: 70,
              maxHeight: 240,
            }}
          />
          <div className="text-dim" style={{ fontSize: 10, marginTop: 4, textAlign: "right" }}>
            {samples[idx].trim().length < MIN_LEN
              ? `${samples[idx].trim().length}/${MIN_LEN} chars`
              : "✓"}
          </div>
        </div>
      ))}

      {ready && (
        <>
          <div style={{
            marginTop: "0.25rem",
            padding: "0.75rem 0.85rem",
            background: "color-mix(in srgb, var(--accent) 5%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            borderRadius: 8,
            display: "flex", flexDirection: "column", gap: "0.7rem",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
              Two quick optional inputs · sharpens drafts
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.3rem" }}>
                Your typical sign-off
              </div>
              <input
                type="text"
                value={signoff}
                onChange={(e) => setSignoff(e.target.value)}
                placeholder="— Alex"
                disabled={analyzing}
                aria-label="Email sign-off"
                style={{
                  width: "100%", padding: "0.45rem 0.6rem",
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
                  color: "var(--text)", fontSize: 12, fontFamily: "inherit", outline: "none",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.3rem" }}>
                Guardrails — anything the avatar should never say in a draft
              </div>
              <ChipInput
                values={guardrails}
                onChange={setGuardrails}
                placeholder="no apologies, no promises about timelines"
                max={5}
                ariaLabel="Draft guardrails"
              />
            </div>
          </div>
        </>
      )}

      {error && <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready || analyzing}
          style={{
            padding: "0.45rem 0.95rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: analyzing ? "wait" : ready ? "pointer" : "not-allowed",
            opacity: ready && !analyzing ? 1 : 0.6,
          }}
        >
          {analyzing ? "Reading your voice…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
