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
import { Pillar1ConfirmCard } from "../components/inline-cards/Pillar1ConfirmCard";
import { Pillar1HaltCard } from "../components/inline-cards/Pillar1HaltCard";
import { Pillar3PromptCard } from "../components/inline-cards/Pillar3PromptCard";
import { Pillar4PromptCard } from "../components/inline-cards/Pillar4PromptCard";
import { Pillar5PromptCard } from "../components/inline-cards/Pillar5PromptCard";
import { reducer, initialState, phaseProgressPct, type ChatMessage, type ChatSlot } from "../state/onboarding-reducer";
import type { Pillar1Response, Pillar3Response, Pillar4Response, Pillar5Response } from "@op-omega/plugin-onboarding";

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

  /** Run Pillar 1 inference end-to-end. Emits a thinking bubble, awaits the
   *  T2 call, then emits either an inline confirm card (success) or an
   *  inline halt card (409). Reused by both welcome submit and halt-resume. */
  const runPillar1 = useCallback(async (
    slug: string,
    rawInput: string,
    manualContext?: string,
  ): Promise<void> => {
    const thinkingId = `thinking-${Date.now().toString(36)}`;
    dispatch({
      type: "ADD_MESSAGE",
      message: {
        id: thinkingId,
        role: "assistant",
        text: manualContext
          ? "Working with what you described…"
          : "Got it. Reading your site and figuring out the shape of this…",
        slot: { kind: "thinking", phase: "pillar-1" },
      },
    });
    try {
      const result = await opOmegaOnboardingApi.pillar1({
        companyId: slug,
        org_name: slug,
        raw_input: rawInput,
        manual_context: manualContext,
      });
      dispatch({ type: "COLLAPSE_MESSAGE", id: thinkingId });
      dispatch({ type: "PILLAR1_RESPONSE", response: result.response });
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          role: "assistant",
          text: "Here's what I inferred — adjust if anything's off.",
          slot: { kind: "pillar1-confirm", response: result.response },
        },
      });
      qc.invalidateQueries({ queryKey: ["status", slug] });
    } catch (e) {
      dispatch({ type: "COLLAPSE_MESSAGE", id: thinkingId });
      if (e instanceof ApiError && e.halt) {
        dispatch({ type: "PILLAR1_HALT", operatorMessage: e.halt.operator_message });
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            role: "assistant",
            text: e.halt.operator_message,
            slot: { kind: "pillar1-halt", operatorMessage: e.halt.operator_message },
          },
        });
      } else {
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            role: "assistant",
            text: `That didn't go through: ${e instanceof Error ? e.message : String(e)}`,
          },
        });
      }
    }
  }, [qc]);

  // ── Welcome → company slug + Pillar 1 ───────────────────────────────────
  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (state.phase.kind === "welcome") {
      const slug = deriveSlug(trimmed);
      dispatch({ type: "ADD_MESSAGE", message: { role: "user", text: trimmed } });
      dispatch({ type: "WELCOME_SUBMIT", rawInput: trimmed });
      setCompanyId(slug);
      await runPillar1(slug, trimmed);
      return;
    }

    // Default: just echo. Subsequent phase handlers wire actual work.
    dispatch({ type: "ADD_MESSAGE", message: { role: "user", text: trimmed } });
  }, [state.phase, setCompanyId, runPillar1]);

  /** Pillar 1 halt-recovery handler — passed into Pillar1HaltCard via the
   *  slot context. The card calls this with the operator's free-text. */
  const handlePillar1Recovery = useCallback((response: Pillar1Response) => {
    dispatch({ type: "PILLAR1_RESPONSE", response });
    dispatch({
      type: "ADD_MESSAGE",
      message: {
        role: "assistant",
        text: "Got it. Here's what I'll work with — adjust if anything's off.",
        slot: { kind: "pillar1-confirm", response },
      },
    });
  }, []);

  /** Pillar 2 silent verify — fires when stage transitions to 2/thinking.
   *  Default claude_plan=max_20x (dev demo path). Surfaces a verify-fail
   *  slot only if the probe reports an installation/auth issue. */
  const verifiedRef = useRef(false);
  useEffect(() => {
    if (state.phase.kind !== "pillars" || state.phase.stage !== 2 || !state.phase.thinking) return;
    if (!companyId || verifiedRef.current) return;
    verifiedRef.current = true;
    void (async () => {
      try {
        const outcome = await opOmegaOnboardingApi.pillar2({
          companyId,
          claude_plan: "max_20x",
        });
        if (outcome.ok) {
          // Silent advance to Pillar 3
          dispatch({ type: "SET_PHASE", phase: { kind: "pillars", stage: 3, thinking: false } });
          dispatch({
            type: "ADD_MESSAGE",
            message: {
              role: "assistant",
              text: "Where are you in the product journey?",
              slot: { kind: "pillar3-prompt" },
            },
          });
        } else {
          const fixHint = (outcome as { fix_hint?: string }).fix_hint
            ?? "Claude CLI isn't responding. Check `claude --version` works on your terminal.";
          dispatch({ type: "VERIFY_FAILED", fixHint });
          dispatch({
            type: "ADD_MESSAGE",
            message: {
              role: "assistant",
              text: "I can't reach your Claude setup.",
              slot: { kind: "verify-fail", fixHint },
            },
          });
        }
      } catch (e) {
        const fixHint = e instanceof Error ? e.message : String(e);
        dispatch({ type: "VERIFY_FAILED", fixHint });
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            role: "assistant",
            text: "Couldn't verify your Claude setup.",
            slot: { kind: "verify-fail", fixHint },
          },
        });
      }
    })();
  }, [state.phase, companyId]);

  const handlePillar3Done = useCallback((response: Pillar3Response) => {
    dispatch({ type: "PILLAR3_DONE", response });
    dispatch({
      type: "ADD_MESSAGE",
      message: {
        role: "assistant",
        text: "How do leads come in?",
        slot: { kind: "pillar4-prompt" },
      },
    });
  }, []);

  const handlePillar4Done = useCallback((response: Pillar4Response) => {
    dispatch({ type: "PILLAR4_DONE", response });
    dispatch({
      type: "ADD_MESSAGE",
      message: {
        role: "assistant",
        text: "How do you want your board to talk to you?",
        slot: { kind: "pillar5-prompt" },
      },
    });
  }, []);

  const handlePillar5Done = useCallback((response: Pillar5Response) => {
    dispatch({ type: "PILLAR5_DONE", response });
    dispatch({
      type: "ADD_MESSAGE",
      message: {
        role: "assistant",
        text: "Got it. Let me figure out what to plug in…",
      },
    });
    // Subsequent step wires the connector picker. For now the chat goes quiet.
  }, []);

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
      <ChatThread
        thread={state.thread}
        slotContext={{
          companyId,
          orgName: companyId ?? deriveSlug(state.draft.pillar1?.rawInput ?? ""),
          rawInput: state.draft.pillar1?.rawInput ?? "",
          onPillar1Confirmed: () => dispatch({ type: "PILLAR1_CONFIRMED" }),
          onPillar1Recovered: handlePillar1Recovery,
          onPillar3Done: handlePillar3Done,
          onPillar4Done: handlePillar4Done,
          onPillar5Done: handlePillar5Done,
        }}
      />
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

interface SlotContext {
  companyId: string | null;
  orgName: string;
  rawInput: string;
  onPillar1Confirmed: () => void;
  onPillar1Recovered: (response: Pillar1Response) => void;
  onPillar3Done: (response: Pillar3Response) => void;
  onPillar4Done: (response: Pillar4Response) => void;
  onPillar5Done: (response: Pillar5Response) => void;
}

function ChatThread({ thread, slotContext }: { thread: ChatMessage[]; slotContext: SlotContext }) {
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
          <ChatBubble key={m.id} message={m} slotContext={slotContext} />
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message, slotContext }: { message: ChatMessage; slotContext: SlotContext }) {
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
      maxWidth: message.slot ? "95%" : "85%",
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
      {message.slot && <SlotRenderer slot={message.slot} slotContext={slotContext} />}
    </div>
  );
}

/** Maps a chat slot tag to its inline-component implementation. */
function SlotRenderer({ slot, slotContext }: { slot: ChatSlot; slotContext: SlotContext }) {
  switch (slot.kind) {
    case "thinking":
      return (
        <div style={{ marginTop: "0.5rem" }}>
          <T2ProgressIndicator active={true} phase={slot.phase} />
        </div>
      );
    case "pillar1-confirm":
      if (!slotContext.companyId) return null;
      return (
        <Pillar1ConfirmCard
          companyId={slotContext.companyId}
          response={slot.response}
          onConfirmed={slotContext.onPillar1Confirmed}
        />
      );
    case "pillar1-halt":
      if (!slotContext.companyId) return null;
      return (
        <Pillar1HaltCard
          companyId={slotContext.companyId}
          orgName={slotContext.orgName}
          rawInput={slotContext.rawInput}
          onRecovered={slotContext.onPillar1Recovered}
        />
      );
    case "pillar3-prompt":
      if (!slotContext.companyId) return null;
      return <Pillar3PromptCard companyId={slotContext.companyId} onDone={slotContext.onPillar3Done} />;
    case "pillar4-prompt":
      if (!slotContext.companyId) return null;
      return <Pillar4PromptCard companyId={slotContext.companyId} onDone={slotContext.onPillar4Done} />;
    case "pillar5-prompt":
      if (!slotContext.companyId) return null;
      return <Pillar5PromptCard companyId={slotContext.companyId} onDone={slotContext.onPillar5Done} />;
    case "verify-fail":
      return (
        <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.75rem", background: "var(--bg)", border: "1px solid var(--warning)", borderRadius: 6, fontSize: 12 }}>
          <div style={{ color: "var(--warning)", fontWeight: 600, marginBottom: "0.25rem" }}>Fix hint</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{slot.fixHint}</div>
          <div className="text-dim" style={{ marginTop: "0.5rem", fontSize: 11 }}>
            Once resolved, reload the page to retry verification.
          </div>
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

