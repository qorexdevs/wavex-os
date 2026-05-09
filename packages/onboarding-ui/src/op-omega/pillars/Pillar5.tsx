/** Pillar 5 — Comms Channel. Telegram credentials route through vault. */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import type { CommChannel, Pillar5Response } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P, RadioGroup } from "../components/primitives";

const CHANNELS: Array<{ value: CommChannel; label: string; description: string }> = [
  { value: "telegram", label: "Telegram", description: "Best for fast on-the-go approvals; bot-driven" },
  { value: "slack", label: "Slack", description: "Best for teams already in Slack" },
  { value: "discord", label: "Discord", description: "Best for community-led companies" },
  { value: "sms", label: "SMS", description: "Best for solo founders without other tools" },
  { value: "email", label: "Email", description: "Fallback; lower urgency" },
];

const URGENCY: Array<{ value: NonNullable<Pillar5Response["urgency_routing"]>; label: string }> = [
  { value: "p0_only", label: "P0 only — only ping me for must-act-now" },
  { value: "p0_and_p1", label: "P0 + P1 — ping for any blocking decision" },
  { value: "all", label: "All — every approval, even routine" },
];

interface Props {
  companyId: string;
  initial: Pillar5Response | undefined;
  onComplete: () => void;
}

const VAULT_PLACEHOLDER = ":vault";

export function Pillar5({ companyId, initial, onComplete }: Props) {
  const [channel, setChannel] = useState<CommChannel>(initial?.comm_channel ?? "telegram");
  const [urgency, setUrgency] = useState<Pillar5Response["urgency_routing"]>(initial?.urgency_routing ?? "p0_and_p1");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const tokenSaved = initial?.telegram_bot_token === VAULT_PLACEHOLDER;
  const chatSaved = initial?.telegram_chat_id === VAULT_PLACEHOLDER;

  const submit = useMutation({
    mutationFn: () => opOmegaOnboardingApi.pillar5({
      companyId,
      comm_channel: channel,
      urgency_routing: urgency,
      telegram_bot_token: botToken.trim() || undefined,
      telegram_chat_id: chatId.trim() || undefined,
    }),
    onSuccess: onComplete,
  });

  const testSend = useMutation({
    mutationFn: () => opOmegaOnboardingApi.pillar5TestSend({
      companyId,
      bot_token: botToken.trim() || undefined,
      chat_id: chatId.trim() || undefined,
      message: "wavex-os onboarding test send",
    }),
  });

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 5 — Comms Channel</H2>
      <P>Where do you want approval requests + alerts? Pick one — the rest can be added later.</P>

      <Card>
        <Field label="Primary channel">
          <RadioGroup value={channel} onChange={setChannel} options={CHANNELS} />
        </Field>
        <Field label="Urgency routing">
          <select value={urgency} onChange={(e) => setUrgency(e.target.value as Pillar5Response["urgency_routing"])}>
            {URGENCY.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </Field>
      </Card>

      {channel === "telegram" && (
        <Card>
          <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Telegram credentials
          </h3>
          <p className="text-dim" style={{ fontSize: 13, marginBottom: "1rem" }}>
            Vaulted on submit (AES-GCM, per-company key derived from <code>CREDENTIAL_VAULT_MASTER_KEY</code>).
            Leave blank to keep existing values.
          </p>
          <Field label={`Bot token${tokenSaved ? " (saved · vaulted)" : ""}`}>
            <input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={tokenSaved ? "•••••••• (leave blank to keep)" : "123456:ABC-..."} />
          </Field>
          <Field label={`Chat ID${chatSaved ? " (saved · vaulted)" : ""}`}>
            <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder={chatSaved ? "(leave blank to keep)" : "-1001234567890"} />
          </Field>
          <button
            type="button"
            className="secondary"
            disabled={testSend.isPending}
            onClick={() => testSend.mutate()}
          >
            {testSend.isPending ? "Sending..." : "Test send"}
          </button>
          {testSend.data && (
            <span className="text-dim" style={{ fontSize: 12, marginLeft: "0.75rem" }}>{testSend.data.detail}</span>
          )}
        </Card>
      )}

      <NavRow next={{ onClick: () => submit.mutate(), label: submit.isPending ? "Saving..." : "Continue → derive connectors" }} nextDisabled={submit.isPending} />
      {submit.isError && <div style={{ color: "var(--warning)", fontSize: 13, marginTop: "0.5rem" }}>{(submit.error as Error).message}</div>}
    </div>
  );
}
