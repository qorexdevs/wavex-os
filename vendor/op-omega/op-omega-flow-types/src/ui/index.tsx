import { useState } from "react";
import {
  usePluginData,
  usePluginAction,
  type PluginDetailTabProps,
  type PluginCommentAnnotationProps,
} from "@paperclipai/plugin-sdk/ui";
import { FLOW_TYPES, FLOW_TYPE_LABELS, FLOW_TYPE_COLORS, type FlowType } from "../flow-types.js";

interface FlowTypeState {
  issueId: string;
  flowType: FlowType | null;
}

export function FlowTypeTab({ context }: PluginDetailTabProps) {
  const issueId = context.entityId ?? "";
  const { data, loading, error, refresh } = usePluginData<FlowTypeState>("flow-type", { issueId });
  const setFlowType = usePluginAction("set-flow-type");
  const clearFlowType = usePluginAction("clear-flow-type");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply(flowType: FlowType) {
    if (!issueId) return;
    setBusy(true);
    setErr(null);
    try {
      await setFlowType({ issueId, flowType });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!issueId) return;
    setBusy(true);
    setErr(null);
    try {
      await clearFlowType({ issueId });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const current = data?.flowType ?? null;

  return (
    <section aria-label="Operator Ω flow type picker" style={{ padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Flow Type</div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
        Classify this ticket for the flywheel causal-edge graph.
      </div>
      {loading && <div>Loading…</div>}
      {error && <div role="alert">Error: {error.message}</div>}
      {!loading && !error && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {FLOW_TYPES.map((ft) => {
              const selected = current === ft;
              return (
                <button
                  key={ft}
                  type="button"
                  disabled={busy}
                  onClick={() => apply(ft)}
                  style={{
                    padding: "6px 12px",
                    border: `2px solid ${FLOW_TYPE_COLORS[ft]}`,
                    background: selected ? FLOW_TYPE_COLORS[ft] : "transparent",
                    color: selected ? "white" : FLOW_TYPE_COLORS[ft],
                    borderRadius: 4,
                    cursor: busy ? "wait" : "pointer",
                    fontWeight: 600,
                  }}
                  aria-pressed={selected}
                >
                  {ft} · {FLOW_TYPE_LABELS[ft]}
                </button>
              );
            })}
          </div>
          {current && (
            <button
              type="button"
              disabled={busy}
              onClick={clear}
              style={{ fontSize: 12, color: "#c00", background: "none", border: "none", cursor: "pointer" }}
            >
              clear
            </button>
          )}
          {err && <div role="alert" style={{ color: "#c00", marginTop: 8 }}>{err}</div>}
        </>
      )}
    </section>
  );
}

export function FlowTypeBadge({ context }: PluginCommentAnnotationProps) {
  const issueId = context.entityId ?? "";
  const { data } = usePluginData<FlowTypeState>("flow-type", { issueId });
  const flowType = data?.flowType;
  if (!flowType) return null;
  return (
    <span
      aria-label={`Flow type ${flowType}`}
      style={{
        display: "inline-block",
        padding: "2px 6px",
        fontSize: 10,
        fontWeight: 700,
        color: "white",
        background: FLOW_TYPE_COLORS[flowType],
        borderRadius: 3,
        marginRight: 4,
      }}
    >
      {flowType}
    </span>
  );
}
