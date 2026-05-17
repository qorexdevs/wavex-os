/** Add Connector widget — a single, clean entry point for adding a tool
 *  to the fleet that makes the connector-acquisition HIERARCHY obvious:
 *
 *      MCP  →  OAuth  →  API key (+ link to get it)
 *
 *  The customer searches/picks a tool; the widget resolves and shows the
 *  BEST available path as a badge ("1-click · MCP" / "Connect · OAuth" /
 *  "Needs API key"), explains what that path means in one line, and
 *  surfaces the FALLBACK CHAIN so they understand why that path was
 *  chosen and what the alternatives are.
 *
 *  ── Where the hierarchy is decided ──
 *  The decision lives in lib/connector-catalog.ts → resolvePath(), which
 *  mirrors the server's per-row logic in wavex-os-server's credentials
 *  route (mcpManaged → composioManaged → expectedKeys). Live MCP-detection
 *  state is layered in from listCredentials() when a companyId is given.
 *
 *  ── Reuse ──
 *  Pure presentational + a thin action layer. Mounted in Phase 2 of
 *  onboarding (Phase2Connectors) and intended to be reusable verbatim in
 *  Mission Control later — it takes a companyId and optional callbacks,
 *  nothing onboarding-specific. The actual credential capture (paste /
 *  OAuth popup) still happens in the existing CredentialDrawer /
 *  CredentialConcierge; this widget's "Add" hands off via onAdded so the
 *  host decides where to route. When no onAdded is provided it falls back
 *  to opening the connector's key/MCP/OAuth help link directly.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { wavexOsOnboardingApi } from "../lib/api";
import {
  CONNECTOR_CATALOG,
  searchCatalog,
  resolvePath,
  pathMeta,
  type ConnectorCatalogEntry,
  type ConnectorLiveState,
  type ConnectorPathKind,
  type ResolvedPath,
} from "../lib/connector-catalog";

interface Props {
  /** Company scope — enables live MCP-detection enrichment via
   *  listCredentials(). Optional: the widget still works as a pure
   *  catalog browser without it. */
  companyId?: string;
  /** Called when the customer commits to adding a connector. The host
   *  (Phase 2 wizard, Mission Control) decides what to do — typically
   *  open the credential drawer focused on this connector. When omitted,
   *  the widget falls back to opening the connector's help link. */
  onAdded?: (connectorId: string, path: ConnectorPathKind) => void;
  /** Optional heading override. */
  title?: string;
}

const PATH_COLOR: Record<ConnectorPathKind, string> = {
  mcp: "var(--accent)",
  oauth: "var(--accent)",
  key: "var(--warning)",
  upstream: "var(--text-dim)",
};

export function AddConnectorWidget({ companyId, onAdded, title }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Live state — only when scoped to a company. Reuses the SAME query key
  // as CredentialDrawer/CredentialConcierge so it shares cache and stays
  // in sync if the customer vaults something elsewhere in the wizard.
  const live = useQuery({
    queryKey: ["concierge", companyId],
    queryFn: () => wavexOsOnboardingApi.listCredentials(companyId!),
    enabled: Boolean(companyId),
  });

  const liveById = useMemo(() => {
    const m = new Map<string, ConnectorLiveState>();
    for (const c of live.data?.connectors ?? []) {
      m.set(c.connectorId, {
        mcpManaged: c.mcpManaged,
        mcpSourcedFrom: c.mcpSourcedFrom,
        status: c.status,
      });
    }
    return m;
  }, [live.data]);

  const results = useMemo(() => searchCatalog(query), [query]);
  const selected = selectedId
    ? CONNECTOR_CATALOG.find((c) => c.id === selectedId) ?? null
    : null;

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 10,
      background: "var(--surface)",
      padding: "1rem 1.1rem 1.1rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.85rem",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title ?? "Add a connector"}</div>
        <div className="text-dim" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
          Pick a tool — we find the easiest way to connect it. We always
          prefer the lowest-friction path:{" "}
          <PathPill kind="mcp" /> if a server exists, else{" "}
          <PathPill kind="oauth" />, else a{" "}
          <PathPill kind="key" />.
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
        placeholder="Search tools — Stripe, Slack, Notion, Supabase…"
        aria-label="Search connectors"
        style={{
          width: "100%",
          padding: "0.5rem 0.65rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
        }}
      />

      {/* Results grid — each card shows the resolved BEST path badge so
          the hierarchy is visible at a glance before you even click. */}
      {!selected && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: "0.5rem",
          maxHeight: 280,
          overflowY: "auto",
          paddingRight: 2,
        }}>
          {results.length === 0 && (
            <div className="text-dim" style={{ fontSize: 12, gridColumn: "1 / -1" }}>
              No tool matches "{query}". Try a different name, or add it later
              from Mission Control with manual API keys.
            </div>
          )}
          {results.map((entry) => {
            const resolved = resolvePath(entry, liveById.get(entry.id));
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                style={{
                  textAlign: "left",
                  padding: "0.55rem 0.6rem",
                  borderRadius: 7,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.4rem" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{entry.label}</span>
                  {resolved.mcpAlreadyConnected && (
                    <span style={{ fontSize: 9, color: "var(--accent)" }}>✓ ready</span>
                  )}
                </div>
                <span className="text-dim" style={{ fontSize: 10 }}>{entry.category}</span>
                <PathBadge resolved={resolved} compact />
              </button>
            );
          })}
        </div>
      )}

      {/* Detail — full hierarchy view for the selected tool. */}
      {selected && (
        <ConnectorDetail
          entry={selected}
          resolved={resolvePath(selected, liveById.get(selected.id))}
          onBack={() => setSelectedId(null)}
          onAdded={onAdded}
        />
      )}

      {companyId && live.isError && (
        <div className="text-dim" style={{ fontSize: 10 }}>
          (Couldn't load live MCP-detection state — paths shown are the
          defaults; installed MCPs still take priority server-side.)
        </div>
      )}
    </div>
  );
}

/** The expanded view for one tool — shows the BEST path prominently, the
 *  full fallback chain underneath, and the relevant action. */
function ConnectorDetail({
  entry, resolved, onBack, onAdded,
}: {
  entry: ConnectorCatalogEntry;
  resolved: ResolvedPath;
  onBack: () => void;
  onAdded?: (connectorId: string, path: ConnectorPathKind) => void;
}) {
  const handleAdd = () => {
    if (onAdded) { onAdded(entry.id, resolved.best); return; }
    // Fallback when no host handler: open the most useful help link for
    // the resolved path so the customer can self-serve.
    const url =
      resolved.best === "mcp" ? entry.mcpInstallHint?.docs :
      resolved.best === "key" ? entry.keysUrl :
      undefined;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          alignSelf: "flex-start",
          fontSize: 11,
          background: "transparent",
          border: "none",
          color: "var(--text-dim)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ← all tools
      </button>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{entry.label}</span>
          <span className="text-dim" style={{ fontSize: 11, marginLeft: 6 }}>{entry.category}</span>
        </div>
        <PathBadge resolved={resolved} />
      </div>

      {/* Best-path explanation */}
      <div style={{
        padding: "0.6rem 0.7rem",
        borderRadius: 7,
        background: "var(--bg)",
        border: `1px solid ${PATH_COLOR[resolved.best]}`,
        fontSize: 12,
        lineHeight: 1.55,
      }}>
        <div style={{ fontWeight: 600, color: PATH_COLOR[resolved.best], marginBottom: 3 }}>
          Best path: {pathMeta(resolved.best).label}
        </div>
        <div className="text-dim">{resolved.blurb}</div>

        {/* Path-specific helper line */}
        {resolved.best === "mcp" && entry.mcpInstallHint && !resolved.mcpAlreadyConnected && (
          <div style={{ marginTop: "0.4rem" }}>
            <span className="text-dim">{entry.mcpInstallHint.install_hint} </span>
            <a href={entry.mcpInstallHint.docs} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
              Install guide ↗
            </a>
          </div>
        )}
        {resolved.best === "key" && entry.keysUrl && (
          <div style={{ marginTop: "0.4rem" }}>
            <span className="text-dim">
              You'll need: {entry.expectedKeys.map((k) => <code key={k} style={{ fontSize: 11 }}>{k} </code>)}
            </span>
            <a href={entry.keysUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
              Get your key ↗
            </a>
          </div>
        )}
      </div>

      {/* Fallback chain — makes the MCP→OAuth→keys hierarchy explicit. */}
      {resolved.chain.length > 1 && (
        <div style={{ fontSize: 11 }}>
          <div className="text-dim" style={{ marginBottom: "0.3rem" }}>
            Fallback chain — if the best path isn't available to you:
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
            {resolved.chain.map((kind, i) => (
              <span key={kind} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <PathPill kind={kind} dimmed={i > 0} />
                {i < resolved.chain.length - 1 && (
                  <span className="text-dim" style={{ fontSize: 11 }}>→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.1rem" }}>
        {resolved.mcpAlreadyConnected ? (
          <div style={{
            fontSize: 12,
            color: "var(--accent)",
            padding: "0.45rem 0",
            fontWeight: 600,
          }}>
            ✓ Already connected — nothing to do.
          </div>
        ) : entry.upstream ? (
          <div className="text-dim" style={{ fontSize: 12, padding: "0.45rem 0" }}>
            ✓ Configured during onboarding — nothing to do.
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            style={{
              padding: "0.5rem 0.95rem",
              borderRadius: 7,
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {resolved.best === "mcp" ? "Add via MCP →" :
             resolved.best === "oauth" ? "Connect with OAuth →" :
             "Add & enter key →"}
          </button>
        )}
      </div>
    </div>
  );
}

/** The resolved best-path badge — the single most important hierarchy
 *  signal in the widget. */
function PathBadge({ resolved, compact }: { resolved: ResolvedPath; compact?: boolean }) {
  const color = PATH_COLOR[resolved.best];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: compact ? "1px 6px" : "2px 8px",
      borderRadius: 4,
      fontSize: compact ? 9 : 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color,
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      whiteSpace: "nowrap",
    }}>
      {pathMeta(resolved.best).glyph} {resolved.badge}
    </span>
  );
}

/** A small inline pill for one path kind — used in the intro line and the
 *  fallback chain. */
function PathPill({ kind, dimmed }: { kind: ConnectorPathKind; dimmed?: boolean }) {
  const meta = pathMeta(kind);
  const color = dimmed ? "var(--text-dim)" : PATH_COLOR[kind];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: "1px 5px",
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 600,
      color,
      background: dimmed ? "transparent" : `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} ${dimmed ? 30 : 40}%, transparent)`,
    }}>
      {meta.glyph} {meta.label}
    </span>
  );
}
