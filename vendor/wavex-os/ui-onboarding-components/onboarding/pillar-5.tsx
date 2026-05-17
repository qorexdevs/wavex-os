import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Send, ShieldAlert } from "lucide-react";
import { wavexOsOnboardingApi } from "../../../api/wavexOsOnboarding";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ExpandedTextInput } from "./ExpandedTextInput";
import { applyHintToOptions, consumeHint } from "./transition-hints";
import { COMM_CHANNELS, URGENCY_ROUTES } from "./options";
import { H2, P, RadioGroup } from "./primitives";

export function Pillar5({
  companyId,
  onDone,
  initial,
}: {
  companyId: string;
  onDone: () => void;
  initial?: {
    comm_channel?: string;
    comm_channel_other?: string;
    urgency_routing?: string;
    urgency_routing_other?: string;
    board_endpoint_config?: Record<string, string>;
  };
}) {
  const urHint = consumeHint("pillar_5.urgency_routing");
  const urOptions = useMemo(() => applyHintToOptions(URGENCY_ROUTES, urHint), [urHint]);
  const [ch, setCh] = useState(initial?.comm_channel ?? "telegram");
  const [chOther, setChOther] = useState(initial?.comm_channel_other ?? "");
  const [ur, setUr] = useState<string | undefined>(
    initial?.urgency_routing ?? (urOptions[0]?.v as string | undefined) ?? "digest_plus_urgent_phone",
  );
  const [urOther, setUrOther] = useState(initial?.urgency_routing_other ?? "");

  // Telegram-specific credential capture (just-in-time per the chosen channel).
  // The server replaces vaulted secrets with the marker `":vault"` so the UI
  // can tell "saved" from "absent" without leaking the secret back. Treat the
  // marker as empty in the input so the operator can choose to keep what's
  // saved (leave blank) or rotate (type a new value).
  const isVaultMarker = (v: string | undefined) => v === ":vault";
  const [telegramBotToken, setTelegramBotToken] = useState(
    isVaultMarker(initial?.board_endpoint_config?.telegram_bot_token)
      ? ""
      : initial?.board_endpoint_config?.telegram_bot_token ?? "",
  );
  const [telegramChatId, setTelegramChatId] = useState(
    isVaultMarker(initial?.board_endpoint_config?.telegram_chat_id)
      ? ""
      : initial?.board_endpoint_config?.telegram_chat_id ?? "",
  );
  const tokenIsVaulted = isVaultMarker(initial?.board_endpoint_config?.telegram_bot_token);
  const chatIdIsVaulted = isVaultMarker(initial?.board_endpoint_config?.telegram_chat_id);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail?: string } | null>(null);

  const chOtherMissing = ch === "other" && chOther.trim().length < 40;
  const urOtherMissing = ch !== "email_only" && ur === "other" && urOther.trim().length < 40;

  const boardEndpointConfig = useMemo<Record<string, string> | undefined>(() => {
    if (ch === "telegram" && telegramBotToken && telegramChatId) {
      return { telegram_bot_token: telegramBotToken, telegram_chat_id: telegramChatId };
    }
    return undefined;
  }, [ch, telegramBotToken, telegramChatId]);

  const test = useMutation({
    mutationFn: () =>
      wavexOsOnboardingApi.pillar5TestSend({
        companyId,
        channel: ch,
        config: boardEndpointConfig ?? {},
      }),
    onSuccess: (res) => setTestResult({ ok: res.ok, detail: res.detail }),
    onError: (e) => setTestResult({ ok: false, detail: e instanceof Error ? e.message : "Test failed" }),
  });

  const submit = useMutation({
    mutationFn: () =>
      wavexOsOnboardingApi.pillar5({
        companyId,
        comm_channel: ch,
        comm_channel_other: ch === "other" ? chOther : undefined,
        urgency_routing: ch === "email_only" ? undefined : ur,
        urgency_routing_other: ch !== "email_only" && ur === "other" ? urOther : undefined,
        board_endpoint_config: boardEndpointConfig,
      }),
    onSuccess: () => onDone(),
  });

  return (
    <>
      <H2>Pillar 5 · Board Communication</H2>
      <P>Where the CEO agent reports to you. Criticality changes, spawn approvals, and budget alerts route here.</P>
      <RadioGroup
        title="Channel"
        value={ch}
        onChange={(v) => {
          setCh(v);
          setTestResult(null);
        }}
        options={COMM_CHANNELS.map((o) => ({ value: o.v, label: o.l }))}
      />
      {ch === "other" && (
        <ExpandedTextInput
          value={chOther}
          onChange={setChOther}
          placeholder="Describe your communication channel — what you use, where urgent signals land."
        />
      )}

      {ch === "telegram" && (
        <TelegramCredentials
          botToken={telegramBotToken}
          chatId={telegramChatId}
          tokenIsVaulted={tokenIsVaulted}
          chatIdIsVaulted={chatIdIsVaulted}
          onBotTokenChange={(v) => {
            setTelegramBotToken(v);
            setTestResult(null);
          }}
          onChatIdChange={(v) => {
            setTelegramChatId(v);
            setTestResult(null);
          }}
          onTest={() => test.mutate()}
          isTesting={test.isPending}
          testResult={testResult}
          canTest={Boolean(telegramBotToken && telegramChatId)}
        />
      )}

      {ch !== "email_only" && (
        <>
          <RadioGroup
            title="Urgency routing"
            value={ur ?? ""}
            onChange={setUr}
            options={urOptions.map((o) => ({ value: o.v, label: o.l }))}
          />
          {urHint?.hint_text_override && <P>{urHint.hint_text_override}</P>}
          {ur === "other" && (
            <ExpandedTextInput
              value={urOther}
              onChange={setUrOther}
              placeholder="Describe your routing preference — what counts as urgent, who should be pinged."
            />
          )}
        </>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || chOtherMissing || urOtherMissing}
        >
          Finish Phase 1 <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </div>
    </>
  );
}

function TelegramCredentials({
  botToken,
  chatId,
  tokenIsVaulted,
  chatIdIsVaulted,
  onBotTokenChange,
  onChatIdChange,
  onTest,
  isTesting,
  testResult,
  canTest,
}: {
  botToken: string;
  chatId: string;
  tokenIsVaulted: boolean;
  chatIdIsVaulted: boolean;
  onBotTokenChange: (v: string) => void;
  onChatIdChange: (v: string) => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: { ok: boolean; detail?: string } | null;
  canTest: boolean;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Telegram credentials
      </div>
      <P>
        Create a bot via{" "}
        <a
          className="underline"
          href="https://t.me/BotFather"
          target="_blank"
          rel="noopener noreferrer"
        >
          @BotFather
        </a>{" "}
        to get a token, then paste your Telegram chat ID (find it via{" "}
        <a
          className="underline"
          href="https://t.me/userinfobot"
          target="_blank"
          rel="noopener noreferrer"
        >
          @userinfobot
        </a>
        ). Optional but recommended — leave blank to bind credentials later from your dashboard.
      </P>
      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            Bot token
            {tokenIsVaulted && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Saved · vaulted
              </span>
            )}
          </label>
          <Input
            type="password"
            placeholder={tokenIsVaulted ? "(saved — type to rotate)" : "e.g. 1234567890:AAFakeTokenHere"}
            value={botToken}
            onChange={(e) => onBotTokenChange(e.target.value)}
          />
          {botToken.length > 0 && !/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(botToken) && (
            <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
              Bot tokens look like <code>1234567890:AAFakeTokenHere</code> — numeric ID + colon + ~35-char secret.
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            Chat ID
            {chatIdIsVaulted && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Saved · vaulted
              </span>
            )}
          </label>
          <Input
            type="text"
            placeholder={chatIdIsVaulted ? "(saved — type to change)" : "e.g. 123456789"}
            value={chatId}
            onChange={(e) => onChatIdChange(e.target.value)}
          />
          {chatId.length > 0 && !/^-?\d+$/.test(chatId) && (
            <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
              Chat IDs are numeric (sometimes negative for groups).
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onTest} disabled={!canTest || isTesting}>
          {isTesting ? "Sending…" : "Send test message"} <Send className="ml-1 size-3" />
        </Button>
        {testResult && testResult.ok && (
          <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> Message sent — check Telegram.
          </span>
        )}
        {testResult && !testResult.ok && (
          <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlert className="size-3.5" /> {testResult.detail ?? "Test failed"}
          </span>
        )}
      </div>
    </div>
  );
}
