/** Pillar 5 · Board Communication. Mirrors upstream pillar-5.tsx:
 *  - RadioGroup for channel
 *  - Telegram-specific credentials when channel=telegram (BotFather link,
 *    inline format hints, vault badge if previously saved, "Send test
 *    message" button to verify before commit)
 *  - urgency_routing only shown when channel ≠ email_only
 *  - vault marker `:vault` rendered as a "Saved · vaulted" badge */

import { useMemo, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { Pillar5Response, CommChannel, UrgencyRouting } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, P } from "../components/primitives";
import { COMM_CHANNELS, URGENCY_ROUTES } from "../lib/options";

interface Props {
  companyId: string;
  initial: Pillar5Response | undefined;
  onComplete: () => void;
}

const isVaultMarker = (v: string | undefined): boolean => v === ":vault";

export function Pillar5({ companyId, initial, onComplete }: Props) {
  const [ch, setCh] = useState<CommChannel>(initial?.comm_channel ?? "telegram");
  const [chOther, setChOther] = useState(initial?.comm_channel_other ?? "");
  const [ur, setUr] = useState<string>(initial?.urgency_routing ?? "digest_plus_urgent_phone");
  const [urOther, setUrOther] = useState(initial?.urgency_routing_other ?? "");

  const tokenIsVaulted = isVaultMarker(initial?.board_endpoint_config?.telegram_bot_token);
  const chatIdIsVaulted = isVaultMarker(initial?.board_endpoint_config?.telegram_chat_id);
  const [tgToken, setTgToken] = useState(
    tokenIsVaulted ? "" : initial?.board_endpoint_config?.telegram_bot_token ?? "",
  );
  const [tgChatId, setTgChatId] = useState(
    chatIdIsVaulted ? "" : initial?.board_endpoint_config?.telegram_chat_id ?? "",
  );

  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chOtherMissing = ch === "other" && chOther.trim().length < 40;
  const urOtherMissing = ch !== "email_only" && ur === "other" && urOther.trim().length < 40;

  const boardEndpointConfig = useMemo<Record<string, string> | undefined>(() => {
    if (ch === "telegram" && tgToken && tgChatId) {
      return { telegram_bot_token: tgToken, telegram_chat_id: tgChatId };
    }
    return undefined;
  }, [ch, tgToken, tgChatId]);

  async function runTest(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await opOmegaOnboardingApi.pillar5TestSend({
        companyId,
        channel: ch as "telegram",
        config: boardEndpointConfig ?? {},
      });
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.pillar5({
        companyId,
        comm_channel: ch,
        comm_channel_other: ch === "other" ? chOther : undefined,
        urgency_routing: ch === "email_only" ? undefined : (ur as UrgencyRouting),
        urgency_routing_other: ch !== "email_only" && ur === "other" ? urOther : undefined,
        board_endpoint_config: boardEndpointConfig,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tokenLooksValid = tgToken.length === 0 || /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(tgToken);
  const chatIdLooksValid = tgChatId.length === 0 || /^-?\d+$/.test(tgChatId);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 5 · Board Communication</H2>
      <P>
        Where the CEO agent reports to you. Criticality changes, spawn
        approvals, and budget alerts route here.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <RadioRow title="Channel" value={ch} onChange={(v) => { setCh(v as CommChannel); setTestResult(null); }}
          options={COMM_CHANNELS.map((o) => ({ v: o.v, l: o.l }))} />

        {ch === "other" && (
          <Field label="Describe channel (≥40 chars)">
            <textarea value={chOther} onChange={(e) => setChOther(e.target.value)} rows={2}
              placeholder="What you use, where urgent signals land." />
            <span className="text-dim" style={{ fontSize: 11 }}>{chOther.trim().length} / 40 minimum</span>
          </Field>
        )}

        {ch === "telegram" && (
          <div style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
              Telegram credentials
            </div>
            <P>
              Create a bot via{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>@BotFather</a>{" "}
              to get a token, then paste your chat ID (find it via{" "}
              <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>@userinfobot</a>).
              Optional — leave blank to bind credentials later from your dashboard.
            </P>

            <Field label={
              <>
                Bot token{" "}
                {tokenIsVaulted && <span style={{ marginLeft: 6, padding: "1px 6px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", background: "var(--accent)", color: "var(--bg)", borderRadius: 3 }}>Saved · vaulted</span>}
              </>
            }>
              <input
                type="password"
                value={tgToken}
                onChange={(e) => { setTgToken(e.target.value); setTestResult(null); }}
                placeholder={tokenIsVaulted ? "(saved — type to rotate)" : "1234567890:AAFakeTokenHere"}
              />
              {!tokenLooksValid && (
                <div style={{ fontSize: 10, color: "var(--warning)", marginTop: 2 }}>
                  Bot tokens look like <code>1234567890:AAFakeTokenHere</code> — numeric ID + colon + ~35-char secret.
                </div>
              )}
            </Field>

            <Field label={
              <>
                Chat ID{" "}
                {chatIdIsVaulted && <span style={{ marginLeft: 6, padding: "1px 6px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", background: "var(--accent)", color: "var(--bg)", borderRadius: 3 }}>Saved · vaulted</span>}
              </>
            }>
              <input
                type="text"
                value={tgChatId}
                onChange={(e) => { setTgChatId(e.target.value); setTestResult(null); }}
                placeholder={chatIdIsVaulted ? "(saved — type to change)" : "123456789"}
              />
              {!chatIdLooksValid && (
                <div style={{ fontSize: 10, color: "var(--warning)", marginTop: 2 }}>
                  Chat IDs are numeric (sometimes negative for groups).
                </div>
              )}
            </Field>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => void runTest()}
                disabled={!tgToken || !tgChatId || testing}
                style={{ fontSize: 12 }}
              >
                {testing ? "Sending…" : "Send test message"} ✉
              </button>
              {testResult && (
                <span style={{
                  fontSize: 11,
                  color: testResult.ok ? "var(--accent)" : "var(--warning)",
                }}>
                  {testResult.ok ? "✓" : "✗"} {testResult.detail}
                </span>
              )}
            </div>
          </div>
        )}

        {ch !== "email_only" && (
          <>
            <RadioRow title="Urgency routing" value={ur} onChange={setUr}
              options={URGENCY_ROUTES.map((o) => ({ v: o.v, l: o.l }))} />
            {ur === "other" && (
              <Field label="Describe routing (≥40 chars)">
                <textarea value={urOther} onChange={(e) => setUrOther(e.target.value)} rows={2}
                  placeholder="What counts as urgent, who should be pinged." />
                <span className="text-dim" style={{ fontSize: 11 }}>{urOther.trim().length} / 40 minimum</span>
              </Field>
            )}
          </>
        )}
      </Card>

      <div className="nav-buttons">
        <span />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || chOtherMissing || urOtherMissing}
        >
          {busy ? "Saving…" : "Finish Phase 1 →"}
        </button>
      </div>
    </div>
  );
}

function RadioRow({
  title, value, onChange, options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ v: string; l: string }>;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ marginBottom: "0.5rem", fontSize: 13, fontWeight: 500 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((o) => (
          <label key={o.v} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "0.5rem 0.75rem",
            border: `1px solid ${value === o.v ? "var(--accent)" : "var(--border)"}`,
            background: value === o.v ? "var(--surface-2)" : "transparent",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}>
            <input type="radio" checked={value === o.v} onChange={() => onChange(o.v)} />
            <span>{o.l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
