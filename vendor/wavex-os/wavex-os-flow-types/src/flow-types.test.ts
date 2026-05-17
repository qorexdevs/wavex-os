import { describe, expect, it } from "vitest";
import { FLOW_TYPES, isFlowType, FLOW_TYPE_LABELS, FLOW_TYPE_COLORS } from "./flow-types.js";

describe("flow-types", () => {
  it("exposes exactly ASN / TLM / CON / VAL", () => {
    expect(FLOW_TYPES).toEqual(["ASN", "TLM", "CON", "VAL"]);
  });

  it("has labels for every type", () => {
    for (const ft of FLOW_TYPES) {
      expect(FLOW_TYPE_LABELS[ft]).toBeTruthy();
      expect(FLOW_TYPE_COLORS[ft]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("validates flow types", () => {
    expect(isFlowType("ASN")).toBe(true);
    expect(isFlowType("VAL")).toBe(true);
    expect(isFlowType("asn")).toBe(false);
    expect(isFlowType("EVT")).toBe(false);
    expect(isFlowType(null)).toBe(false);
    expect(isFlowType(undefined)).toBe(false);
    expect(isFlowType(42)).toBe(false);
  });
});
