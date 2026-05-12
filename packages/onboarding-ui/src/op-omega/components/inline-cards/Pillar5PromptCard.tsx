/** Inline prompt card for Pillar 5 — board communication channel +
 *  conditional urgency routing + conditional Telegram credentials. */

import { useState } from "react";
import type { Pillar5Response, CommChannel, UrgencyRouting } from "@op-omega/plugin-onboarding";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";
import { ResponseChips } from "../ResponseChips";
import { COMM_CHANNELS, URGENCY_ROUTES } from "../../lib/options";

const COMM_OPTS = COMM_CHANNELS.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));
const URGENCY_OPTS = URGENCY_ROUTES.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));

interface Props {
  companyId: string;
  onDone: (response: Pillar5Response) => void;
}

export function Pillar5PromptCard({ companyId, onDone }: Props) {
  const [commCanon, setCommCanon] = useState<string[]>([]);
  const [commCustom, setCommCustom] = useState<string[]>([]);
  const [urgencyCanon, setUrgencyCanon] = useState<string[]>([]);
  const [urgencyCustom, setUrgencyCustom] = useState<string[]>([]);
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);

  async function handleTestSend(): Promise<void> {
    if (!tgBotToken || !tgChatId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await opOmegaOnboardingApi.pillar5TestSend({
        companyId,
        channel: "telegram",
        config: { telegram_bot_token: tgBotToken, telegram_chat_id: tgChatId },
      });
      setTestResult({ ok: r.ok, detail: r.detail });
    } catch (e) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  const commValue = commCustom[0] ?? commCanon[0] ?? "";
  const commIsCustom = commCustom.length > 0;
  const needsUrgency = !!commValue && commValue !== "email_only";
  const urgencyValue = urgencyCustom[0] ?? urgencyCanon[0] ?? "";
  const urgencyIsCustom = urgencyCustom.length > 0;
  const isTelegram = commValue === "telegram";

  const telegramReady = !isTelegram || (!!tgBotToken && !!tgChatId);
  const ready = !!commValue && (!needsUrgency || !!urgencyValue) && telegramReady;

  async function handleSubmit(): Promise<void> {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const board_endpoint_config: Record<string, string> = isTelegram
        ? { telegram_bot_token: tgBotToken, telegram_chat_id: tgChatId }
        : {};

      const result = await opOmegaOnboardingApi.pillar5({
        companyId,
        comm_channel: (commIsCustom ? "other" : commValue) as CommChannel,
        comm_channel_other: commIsCustom ? commValue : undefined,
        urgency_routing: needsUrgency
          ? ((urgencyIsCustom ? "other" : urgencyValue) as UrgencyRouting)
          : undefined,
        urgency_routing_other: needsUrgency && urgencyIsCustom ? urgencyValue : undefined,
        board_endpoint_config: Object.keys(board_endpoint_config).length > 0 ? board_endpoint_config : undefined,
      });
      onDone(result.response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
          Where should your board talk to you?
        </div>
        <ResponseChips
          mode="single"
          options={COMM_OPTS}
          values={commCanon}
          customValues={commCustom}
          allowCustom
          customLabel="Other channel"
          onChange={(v) => { setCommCanon(v); setUrgencyCanon([]); setUrgencyCustom([]); }}
          onCustomChange={(v) => { setCommCustom(v); setUrgencyCanon([]); setUrgencyCustom([]); }}
          disabled={submitting}
        />
      </div>

      {isTelegram && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>
            Telegram credentials
          </div>
          <input
            type="password"
            placeholder="Bot token"
            value={tgBotToken}
            onChange={(e) => setTgBotToken(e.target.value)}
            disabled={submitting}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Chat ID"
            value={tgChatId}
            onChange={(e) => setTgChatId(e.target.value)}
            disabled={submitting}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => void handleTestSend()}
              disabled={submitting || testing || !tgBotToken || !tgChatId}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: 4,
                background: "transparent",
                color: "var(--text-dim)",
                border: "1px solid var(--border)",
                fontSize: 11,
                cursor: testing || !tgBotToken || !tgChatId ? "not-allowed" : "pointer",
              }}
            >
              {testing ? "Sending…" : "Send test message"}
            </button>
            {testResult && (
              <span style={{ fontSize: 11, color: testResult.ok ? "var(--accent)" : "var(--warning)" }}>
                {testResult.ok ? "✓" : "✗"} {testResult.detail}
              </span>
            )}
          </div>
          <div className="text-dim" style={{ fontSize: 10 }}>
            Vaulted locally — never sent off your machine in dev.
          </div>
        </div>
      )}

      {needsUrgency && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
            Urgency routing
          </div>
          <ResponseChips
            mode="single"
            options={URGENCY_OPTS}
            values={urgencyCanon}
            customValues={urgencyCustom}
            allowCustom
            customLabel="Other routing"
            onChange={setUrgencyCanon}
            onCustomChange={setUrgencyCustom}
            disabled={submitting}
          />
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

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
