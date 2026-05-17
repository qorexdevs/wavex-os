import { ShieldAlert } from "lucide-react";

export function friendlyConnectorName(id: string): string {
  const map: Record<string, string> = {
    "claude-code": "Claude Code (inference)",
    supabase: "Supabase (your data + auth)",
    github: "GitHub (code + ship events)",
    slack: "Slack (Board notifications)",
    telegram: "Telegram (Board notifications)",
    whatsapp: "WhatsApp (Board notifications)",
    mixpanel: "Mixpanel (product analytics)",
    "meta-ads-api": "Meta Ads (attribution)",
    "google-ads-api": "Google Ads (attribution)",
    "linkedin-sales-nav": "LinkedIn Sales Navigator",
    "twilio-sms": "Twilio SMS",
  };
  return map[id] ?? id;
}

export function ConnectorView({
  data,
}: {
  data: {
    required: Array<{ id: string; priority: string; rationale: string }>;
    suggested: Array<{ id: string; rationale: string }>;
    deferred: Array<{ id: string; rationale: string }>;
    blocked_on_manual_approval: Array<{ id: string; reason: string }>;
  };
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
          {data.required.length} required
        </span>
        {data.suggested.length > 0 && (
          <span className="rounded bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-400">
            {data.suggested.length} suggested for your situation
          </span>
        )}
        {data.blocked_on_manual_approval.length > 0 && (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
            {data.blocked_on_manual_approval.length} will need your explicit approval
          </span>
        )}
      </div>

      {data.blocked_on_manual_approval.length > 0 && (
        <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
            <ShieldAlert className="size-3.5" /> These tools grant write access — your approval unlocks them
          </div>
          <ul className="mt-1 space-y-1">
            {data.blocked_on_manual_approval.map((b) => (
              <li key={b.id}>
                <span className="font-medium">{friendlyConnectorName(b.id)}</span>
                <div className="text-muted-foreground">{b.reason}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="text-[11px] font-semibold uppercase text-muted-foreground">Required for core operation</div>
        <ul className="mt-1 space-y-1">
          {data.required.map((r) => (
            <li key={r.id} className="rounded-md border bg-emerald-500/5 p-2">
              <div className="flex items-center gap-2 font-medium">
                {friendlyConnectorName(r.id)}
                <span className="rounded bg-muted px-1 text-[10px] uppercase">{r.priority}</span>
              </div>
              <div className="text-xs text-muted-foreground">{r.rationale}</div>
            </li>
          ))}
        </ul>
      </section>

      {data.suggested.length > 0 && (
        <section>
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">Recommended for your situation</div>
          <ul className="mt-1 space-y-1">
            {data.suggested.map((r) => (
              <li key={r.id} className="rounded-md border p-2">
                <div className="font-medium">{friendlyConnectorName(r.id)}</div>
                <div className="text-xs text-muted-foreground">{r.rationale}</div>
              </li>
            ))}
          </ul>
          <div className="mt-1 text-[10px] text-muted-foreground">
            You can configure any of these later from your dashboard.
          </div>
        </section>
      )}

      {data.deferred.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Other tools available when your situation changes ({data.deferred.length})
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {data.deferred.map((d) => (
              <li key={d.id}>
                <span className="font-medium">{friendlyConnectorName(d.id)}</span> — {d.rationale}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
