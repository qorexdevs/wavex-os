/** Persistent help chat sidebar. Renders as a collapsible panel docked
 *  to the right edge of the wizard. Operator types a question; we send
 *  it to /api/instance/:id/help-chat with the current phase as context.
 *  T2-grounded answer comes back, gets persisted, and shows in the
 *  conversation thread. Shared across all pillars/phases — same
 *  conversation for the whole onboarding session.
 *
 *  This is read-only: explains fields and concepts but never mutates
 *  pillar/phase state. */

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";

interface Props {
  companyId: string;
  /** Current phase id (e.g. "pillar-1") so the assistant knows context. */
  phase: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  ts_iso: string;
  text: string;
  phase?: string;
  field?: string;
}

export function HelpChat({ companyId, phase }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["help-chat", companyId],
    queryFn: () => wavexOsOnboardingApi.getHelpChat(companyId),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const messages: ChatMessage[] = q.data?.messages ?? [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await wavexOsOnboardingApi.postHelpChat(companyId, { message: text, phase });
      await qc.invalidateQueries({ queryKey: ["help-chat", companyId] });
      setDraft("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Toggle tab — always visible, fixed to right edge */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close help chat" : "Open help chat"}
        style={{
          position: "fixed", right: open ? 380 : 0, top: "50%",
          transform: "translateY(-50%)",
          zIndex: 30,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRight: open ? "none" : "1px solid var(--border)",
          borderRadius: open ? "6px 0 0 6px" : "6px 0 0 6px",
          padding: "0.75rem 0.4rem",
          cursor: "pointer",
          fontSize: 11,
          writingMode: "vertical-rl",
          transition: "right 0.15s ease",
          color: "var(--text)",
        }}
      >
        💬 {open ? "Close" : "Help"}
      </button>

      {open && (
        <aside
          style={{
            position: "fixed", right: 0, top: 0, bottom: 0,
            width: 380,
            background: "var(--surface)",
            borderLeft: "1px solid var(--border)",
            zIndex: 25,
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{
            padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)",
            fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            💬 Onboarding help
            <span className="text-dim" style={{ fontSize: 11, fontWeight: 400 }}>
              · {phase}
            </span>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1, overflowY: "auto", padding: "0.75rem 1rem",
              display: "flex", flexDirection: "column", gap: "0.5rem",
            }}
          >
            {messages.length === 0 && !q.isLoading && (
              <div className="text-dim" style={{ fontSize: 12, padding: "1rem 0" }}>
                Ask about any field or concept — e.g. "what's a comm channel?",
                "what should I pick if I sell B2B and B2C?", "what does business
                model affect downstream?"
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "0.5rem 0.7rem",
                  borderRadius: 8,
                  fontSize: 12,
                  background: m.role === "user" ? "var(--accent)" : "var(--bg)",
                  color: m.role === "user" ? "var(--bg)" : "var(--text)",
                  border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="text-dim" style={{ fontSize: 11, fontStyle: "italic" }}>
                ⟲ thinking…
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: "0.5rem 1rem", borderTop: "1px solid var(--warning)",
              color: "var(--warning)", fontSize: 11,
            }}>
              ✗ {error}
            </div>
          )}

          <div style={{
            padding: "0.6rem 0.75rem", borderTop: "1px solid var(--border)",
            display: "flex", gap: "0.4rem",
          }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask anything about this field… (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={sending}
              style={{
                flex: 1, fontSize: 12, resize: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !draft.trim()}
              style={{ fontSize: 11, padding: "0.4rem 0.6rem" }}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
