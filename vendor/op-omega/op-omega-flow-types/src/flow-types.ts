export const FLOW_TYPES = ["ASN", "TLM", "CON", "VAL"] as const;
export type FlowType = (typeof FLOW_TYPES)[number];

export const FLOW_TYPE_LABELS: Record<FlowType, string> = {
  ASN: "Assignment",
  TLM: "Telemetry",
  CON: "Constraint",
  VAL: "Value",
};

export const FLOW_TYPE_COLORS: Record<FlowType, string> = {
  ASN: "#c11b2a",
  TLM: "#1565c0",
  CON: "#d4751f",
  VAL: "#2e7d32",
};

export const ENTITY_TYPE = "op-omega.flow-type" as const;

export function isFlowType(value: unknown): value is FlowType {
  return typeof value === "string" && (FLOW_TYPES as readonly string[]).includes(value);
}
