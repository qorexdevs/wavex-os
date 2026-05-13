/**
 * WaveX plugin UI bundles.
 *
 * Three slot components mounted into Paperclip's dashboard / sidebar /
 * settings page. All read-only — the user takes any action via Paperclip's
 * native commands or by jumping to the wavex-os Mission Control. This
 * keeps the plugin from getting out of sync with the host's authority
 * model (issues are still the source of truth for state changes).
 */
import { usePluginData } from "@wavex-os/plugin-sdk-shim/ui";
import type {
  PluginWidgetProps,
  PluginSidebarProps,
  PluginSettingsPageProps,
} from "@wavex-os/plugin-sdk-shim/ui";

const WAVEX_COLOR = "#00d4ff";
const WAVEX_BG = "color-mix(in srgb, #00d4ff 6%, transparent)";

// ---------------------------------------------------------------------------
// Dashboard widget — Expert Agents catalog + active hires per agent
// ---------------------------------------------------------------------------

interface ExpertAgentsResponse {
  agents: Array<{ id: string; displayName: string; activeHires: number }>;
  source: string;
}

export function ExpertAgentsStatusWidget(_: PluginWidgetProps) {
  const { data, loading, error } = usePluginData<ExpertAgentsResponse>(
    "expert-agents-list",
    {},
  );

  if (loading) return <SkeletonCard label="WaveX Expert Agents" />;
  if (error) {
    return (
      <Card label="WaveX Expert Agents">
        <div style={{ color: "#ff6b6b" }}>
          Couldn't reach WaveX: {error.message}
        </div>
      </Card>
    );
  }
  if (!data || data.agents.length === 0) {
    return (
      <Card label="WaveX Expert Agents">
        <div style={{ opacity: 0.7 }}>
          {data?.source === "no-supabase-config"
            ? "Configure Supabase URL + publishable key in WaveX Preferences to enable this widget."
            : "No Expert Agents in catalog yet."}
        </div>
      </Card>
    );
  }

  return (
    <Card label="WaveX Expert Agents">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {data.agents.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <td style={{ padding: "6px 0", fontWeight: 500 }}>{a.displayName}</td>
              <td style={{ padding: "6px 0", textAlign: "right", opacity: 0.7 }}>
                {a.activeHires} active hire{a.activeHires === 1 ? "" : "s"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — current company's inception status
// ---------------------------------------------------------------------------

interface InceptionStatusResponse {
  agentsTotal: number;
  agentsReady: number;
  source: string;
}

export function InceptionStatusPanel({ context }: PluginSidebarProps) {
  const { data, loading } = usePluginData<InceptionStatusResponse>(
    "inception-status",
    { companyId: context.companyId },
  );

  return (
    <Card label="Inception Status">
      {loading ? (
        <div style={{ opacity: 0.6 }}>Checking fleet readiness…</div>
      ) : data ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 600, color: WAVEX_COLOR }}>
            {data.agentsReady}
            <span style={{ fontSize: 14, opacity: 0.6 }}> / {data.agentsTotal} ready</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            {data.agentsTotal === 0
              ? "Fleet not yet incepted. Finalize onboarding in WaveX Mission Control."
              : data.agentsReady === data.agentsTotal
                ? "Fleet is fully live. First cycle starts at next heartbeat tick."
                : `${data.agentsTotal - data.agentsReady} agents still spawning.`}
          </div>
        </>
      ) : (
        <div style={{ opacity: 0.6 }}>No fleet data for this company.</div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Settings page — subscription overview + Supabase config hint
// ---------------------------------------------------------------------------

interface SubInfoResponse {
  configured: boolean;
  expertAgentsHired?: number;
  lastStripeWebhookAt?: string | null;
  lastStripeWebhookType?: string | null;
  error?: string;
}

export function WaveXSettingsPage(_: PluginSettingsPageProps) {
  const { data, loading } = usePluginData<SubInfoResponse>("subscription-info", {});

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, color: WAVEX_COLOR }}>WaveX OS — preferences</h2>
      <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
        This panel reads data from the wavex-os op-omega-server and (optionally) the
        configured Supabase project. All actions still happen via Paperclip's native
        issue + agent flows. To change endpoints, edit the plugin instance config in
        Paperclip's Admin Panel.
      </p>

      <Card label="Subscription">
        {loading ? (
          <div style={{ opacity: 0.6 }}>Reading subscription state…</div>
        ) : !data?.configured ? (
          <div style={{ opacity: 0.7 }}>
            Supabase URL + publishable key not set. Configure them in the plugin
            instance config to enable subscription + marketplace insights.
          </div>
        ) : data.error ? (
          <div style={{ color: "#ff6b6b" }}>Couldn't read subscription state: {data.error}</div>
        ) : (
          <>
            <Row label="Active Expert Agent hires">{data.expertAgentsHired ?? 0}</Row>
            <Row label="Last Stripe webhook">
              {data.lastStripeWebhookAt
                ? `${new Date(data.lastStripeWebhookAt).toLocaleString()} (${data.lastStripeWebhookType ?? "?"})`
                : "no events yet"}
            </Row>
          </>
        )}
      </Card>

      <Card label="Where to go next">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          <li>
            <a href="http://localhost:5173/mission" style={{ color: WAVEX_COLOR }}>
              WaveX Mission Control
            </a>{" "}
            — KPI scoreboard, fleet graph, inception CTA.
          </li>
          <li>
            <a href="http://localhost:5173/pricing" style={{ color: WAVEX_COLOR }}>
              Expert Agent marketplace
            </a>{" "}
            — hire new catalog agents.
          </li>
          <li>
            See <code>docs/EXPERT_AGENT_MARKETPLACE_V2.md</code> in the wavex-os repo
            for the upcoming agent roster.
          </li>
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny in-bundle UI primitives (avoid a full design system dep — keeps bundle
// small and matches Paperclip's neutral host theme via CSS variables).
// ---------------------------------------------------------------------------

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      style={{
        padding: "12px 14px",
        borderRadius: 6,
        border: `1px solid color-mix(in srgb, ${WAVEX_COLOR} 25%, transparent)`,
        background: WAVEX_BG,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          opacity: 0.7,
          marginBottom: 8,
          color: WAVEX_COLOR,
        }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

function SkeletonCard({ label }: { label: string }) {
  return (
    <Card label={label}>
      <div style={{ opacity: 0.5 }}>Loading…</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        fontSize: 13,
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
