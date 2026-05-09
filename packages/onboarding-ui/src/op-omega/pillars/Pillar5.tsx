/** Pillar 5 — Comms Channel. Op-omega upstream contract:
 *  Input  : { companyId, comm_channel, urgency_routing?, board_endpoint_config? }
 *    board_endpoint_config carries channel-specific KV (e.g.
 *    telegram_bot_token / telegram_chat_id) — the server moves these to the
 *    encrypted credential vault before saving the pillar response. */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { Pillar5Response, CommChannel, UrgencyRouting } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P } from "../components/primitives";

const COMM_CHANNELS: Array<{ value: CommChannel; label: string }> = [
  { value: "telegram", label: "Telegram" },
  { value: "slack", label: "Slack" },
  { value: "sms", label: "SMS" },
  { value: "email_only", label: "Email only" },
  { value: "other", label: "Other" },
];

const URGENCY_ROUTINGS: Array<{ value: UrgencyRouting; label: string }> = [
  { value: "all_to_one_channel", label: "All to one channel" },
  { value: "digest_plus_urgent_phone", label: "Digest + urgent → phone" },
  { value: "other", label: "Other" },
];

interface Props {
  companyId: string;
  initial: Pillar5Response | undefined;
  onComplete: () => void;
}

export function Pillar5({ companyId, initial, onComplete }: Props) {
  const [channel, setChannel] = useState<CommChannel>(initial?.comm_channel ?? "telegram");
  const [channelOther, setChannelOther] = useState(initial?.comm_channel_other ?? "");
  const [urgency, setUrgency] = useState<UrgencyRouting | "">(initial?.urgency_routing ?? "all_to_one_channel");
  const [urgencyOther, setUrgencyOther] = useState(initial?.urgency_routing_other ?? "");
  const [tgToken, setTgToken] = useState(initial?.board_endpoint_config?.telegram_bot_token ?? "");
  const [tgChatId, setTgChatId] = useState(initial?.board_endpoint_config?.telegram_chat_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const board: Record<string, string> = {};
      if (channel === "telegram") {
        if (tgToken.trim()) board.telegram_bot_token = tgToken.trim();
        if (tgChatId.trim()) board.telegram_chat_id = tgChatId.trim();
      }
      await opOmegaOnboardingApi.pillar5({
        companyId,
        comm_channel: channel,
        comm_channel_other: channel === "other" ? channelOther : undefined,
        urgency_routing: (urgency || undefined) as UrgencyRouting | undefined,
        urgency_routing_other: urgency === "other" ? urgencyOther : undefined,
        board_endpoint_config: Object.keys(board).length > 0 ? board : undefined,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 5 — Comms Channel</H2>
      <P>
        Where do agents reach you? Telegram secrets are moved to the encrypted
        credential vault — they don't touch the on-disk pillar response.
        You can configure tokens later from Mission Control if you skip them now.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <Field label="Channel" required>
          <select value={channel} onChange={(e) => setChannel(e.target.value as CommChannel)}>
            {COMM_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        {channel === "other" && (
          <Field label="Describe channel">
            <input value={channelOther} onChange={(e) => setChannelOther(e.target.value)} />
          </Field>
        )}

        <Field label="Urgency routing">
          <select value={urgency} onChange={(e) => setUrgency(e.target.value as UrgencyRouting | "")}>
            <option value="">— skip —</option>
            {URGENCY_ROUTINGS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </Field>
        {urgency === "other" && (
          <Field label="Describe routing">
            <input value={urgencyOther} onChange={(e) => setUrgencyOther(e.target.value)} />
          </Field>
        )}

        {channel === "telegram" && (
          <>
            <div className="text-dim" style={{ fontSize: 12, marginTop: "0.75rem", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Telegram credentials (vault — optional now)
            </div>
            <Field label="Bot token">
              <input type="password" value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456789:ABCDEF…" />
            </Field>
            <Field label="Chat ID">
              <input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="-100123456789" />
            </Field>
          </>
        )}
      </Card>

      <NavRow
        next={{ onClick: submit, label: busy ? "Saving…" : "Continue →" }}
        nextDisabled={busy || (channel === "other" && channelOther.trim().length === 0)}
      />
    </div>
  );
}
