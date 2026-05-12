/** Chat-first onboarding shell — replaces the multi-page wizard with a
 *  single-screen conversation. Reuses the existing T2 inference pipeline
 *  end-to-end; what changes is orchestration. Earned full-screen reveals
 *  (Swarm Studio, Imprint Theater) take over only at the moments that
 *  warrant them; everything else stays inline in the chat. */

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { useCompany, slugifyCompanyId } from "../lib/CompanyContext";
import { isT0FastMode } from "../lib/dev-flags";
import { TokenCounter } from "../components/TokenCounter";
import { BudgetChip } from "../components/BudgetChip";
import { T2ProgressIndicator } from "../components/T2ProgressIndicator";
import { reducer, initialState, phaseProgressPct, type ChatMessage, type ChatSlot } from "../state/onboarding-reducer";

/** Heuristic: does the typed input look like a URL or a hostname?
 *  If yes we'll use the hostname as the slug seed; otherwise first 3 words. */
function deriveSlug(rawInput: string): string {
  const trimmed = rawInput.trim();
  const urlMatch = trimmed.match(/(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
  if (urlMatch) {
    const host = urlMatch[1].replace(/^www\./i, "");
    const labels = host.split(".");
    return slugifyCompanyId(labels[0]);
  }
  const words = trimmed.split(/\s+/).slice(0, 3).join(" ");
  return slugifyCompanyId(words || "company");
}

export function OnboardingShell() {
  const { companyId, setCompanyId } = useCompany();
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const t0 = isT0FastMode();

  // ── First mount: seed welcome message ───────────────────────────────────
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (!companyId) {
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          role: "assistant",
          text: "Tell me about what you're building. Drop a URL, a GitHub repo, or just describe it — I'll take it from there.",
        },
      });
    } else {
      // Resume path: just acknowledge. Hydration logic will drive next steps.
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          role: "assistant",
          text: `Welcome back to ${companyId}. Picking up where you left off.`,
        },
      });
    }
  }, [companyId]);

  // ── Welcome → company slug + Pillar 1 ───────────────────────────────────
  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (state.phase.kind === "welcome") {
      const slug = deriveSlug(trimmed);
      // Add user message
      dispatch({ type: "ADD_MESSAGE", message: { role: "user", text: trimmed } });
      // Add a thinking placeholder
      const thinkingId = `thinking-${Date.now().toString(36)}`;
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          id: thinkingId,
          role: "assistant",
          text: "Got it. Reading your site and figuring out the shape of this…",
          slot: { kind: "thinking", phase: "pillar-1" },
        },
      });
      // Move to pillars stage 1, thinking
      dispatch({ type: "WELCOME_SUBMIT", rawInput: trimmed });
      // Set companyId in URL so subsequent calls have it
      setCompanyId(slug);

      // Fire Pillar 1 in background
      try {
        const result = await opOmegaOnboardingApi.pillar1({
          companyId: slug,
          org_name: slug,
          raw_input: trimmed,
        });
        dispatch({ type: "PILLAR1_RESPONSE", response: result.response });
        dispatch({ type: "COLLAPSE_MESSAGE", id: thinkingId });
        // Step 5 will swap this for the inline confirm card. For the
        // skeleton, surface the inferred industry as a text bubble + a
        // continue affordance.
        const r = result.response;
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            role: "assistant",
            text: `Inferred: ${r.industry_hint ?? "unknown industry"} · ${r.business_model_hint ?? "unknown model"} · ${r.has_product ? "has product" : "pre-product"}.\n\n${r.company_context ?? ""}`,
          },
        });
        qc.invalidateQueries({ queryKey: ["status", slug] });
      } catch (e) {
        const isHalt = e instanceof ApiError && e.halt;
        if (isHalt) {
          dispatch({ type: "PILLAR1_HALT", operatorMessage: e.halt!.operator_message });
          dispatch({ type: "COLLAPSE_MESSAGE", id: thinkingId });
          dispatch({
            type: "ADD_MESSAGE",
            message: {
              role: "assistant",
              text: `${e.halt!.operator_message}\n\nTell me about your product in your own words and I'll work with that.`,
            },
          });
        } else {
          dispatch({ type: "COLLAPSE_MESSAGE", id: thinkingId });
          dispatch({
            type: "ADD_MESSAGE",
            message: {
              role: "assistant",
              text: `That didn't go through: ${e instanceof Error ? e.message : String(e)}`,
            },
          });
        }
      }
      return;
    }

    // Default: just echo for now. Subsequent phase handlers wire actual work.
    dispatch({ type: "ADD_MESSAGE", message: { role: "user", text: trimmed } });
  }, [state.phase, setCompanyId, qc]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
    }}>
      <TopBar
        companyId={companyId}
        progressPct={phaseProgressPct(state.phase)}
        t0={t0}
      />
      <ChatThread thread={state.thread} />
      <ChatInput onSubmit={handleSubmit} disabled={state.phase.kind === "welcome" ? false : state.phase.kind === "pillars" && state.phase.thinking} />
      {/* Phase-specific overlays mount here in later steps:
       *   - CredentialDrawer (Step 7)
       *   - SwarmStudio (Step 8)
       *   - ImprintTheater (Step 10)
       *   - Pricing dialog + ActivateProgress (Step 11) */}
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────

function TopBar({
  companyId, progressPct, t0,
}: {
  companyId: string | null;
  progressPct: number;
  t0: boolean;
}) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 10,
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      padding: "0.5rem 1rem",
      display: "flex", alignItems: "center", gap: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>WaveX OS</span>
        {companyId ? (
          <span className="text-dim" style={{ fontSize: 11 }}>
            · <code>{companyId}</code>
          </span>
        ) : (
          <span className="text-dim" style={{ fontSize: 11 }}>· new onboarding</span>
        )}
        {t0 && (
          <span style={{
            fontSize: 10, padding: "0.1rem 0.4rem",
            border: "1px solid var(--warning)",
            color: "var(--warning)",
            borderRadius: 999,
            marginLeft: "0.25rem",
          }}>
            Fast mode
          </span>
        )}
      </div>

      <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${progressPct}%`,
          background: "var(--accent)",
          transition: "width 0.4s ease-out",
        }} />
      </div>

      {companyId && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TokenCounter companyId={companyId} />
          <BudgetChip companyId={companyId} />
        </div>
      )}
    </header>
  );
}

// ── Chat thread ───────────────────────────────────────────────────────────

function ChatThread({ thread }: { thread: ChatMessage[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [thread.length, thread[thread.length - 1]?.text]);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "1.5rem 1rem 6rem",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {thread.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (message.collapsed) {
    return (
      <div className="text-dim" style={{
        fontSize: 11,
        alignSelf: isUser ? "flex-end" : "flex-start",
        padding: "0.2rem 0.5rem",
        borderLeft: "2px solid var(--border)",
        opacity: 0.6,
      }}>
        {message.text ? message.text.split("\n")[0].slice(0, 80) : "(handled)"}
      </div>
    );
  }

  return (
    <div style={{
      alignSelf: isUser ? "flex-end" : "flex-start",
      maxWidth: "85%",
      padding: "0.6rem 0.85rem",
      borderRadius: 10,
      background: isUser ? "var(--accent)" : isSystem ? "transparent" : "var(--surface)",
      color: isUser ? "var(--bg)" : "var(--text)",
      border: isUser ? "none" : "1px solid var(--border)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      {message.text}
      {message.slot && <SlotRenderer slot={message.slot} />}
    </div>
  );
}

/** Maps a chat slot tag to its inline-component implementation. Subsequent
 *  steps (5, 6, 7) wire the kinds that aren't yet implemented. */
function SlotRenderer({ slot }: { slot: ChatSlot }) {
  switch (slot.kind) {
    case "thinking":
      return (
        <div style={{ marginTop: "0.5rem" }}>
          <T2ProgressIndicator active={true} phase={slot.phase} />
        </div>
      );
    default:
      return null;
  }
}

// ── Persistent input ──────────────────────────────────────────────────────

function ChatInput({
  onSubmit, disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = draft;
      setDraft("");
      onSubmit(text);
    }
  }

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "color-mix(in srgb, var(--surface) 92%, transparent)",
      borderTop: "1px solid var(--border)",
      backdropFilter: "blur(6px)",
      padding: "0.6rem 1rem",
      zIndex: 20,
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={disabled ? "Working…" : "Type a message…"}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            padding: "0.6rem 0.8rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13,
            fontFamily: "inherit",
            lineHeight: 1.4,
            minHeight: 38,
            maxHeight: 160,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => { const text = draft; setDraft(""); onSubmit(text); }}
          disabled={disabled || !draft.trim()}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 8,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            cursor: disabled || !draft.trim() ? "not-allowed" : "pointer",
            opacity: disabled || !draft.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

