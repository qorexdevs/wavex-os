import { describe, expect, it } from "vitest";
import { looksLikeNoProduct, handlePillar1 } from "./pillar-1.js";

describe("Pillar 1 · Organization Identity", () => {
  it("detects no-product markers", () => {
    expect(looksLikeNoProduct("no product yet")).toBe(true);
    expect(looksLikeNoProduct("we are pre-product")).toBe(true);
    expect(looksLikeNoProduct("none yet")).toBe(true);
    expect(looksLikeNoProduct("https://acme.com")).toBe(false);
    expect(looksLikeNoProduct("github.com/acme/tool")).toBe(false);
  });

  it("returns pre-product branch for no-product input without calling T2", async () => {
    const r = await handlePillar1({ org_name: "Acme", raw_input: "no product yet" });
    expect(r.has_product).toBe(false);
    expect(r.industry_hint).toBe("unknown");
    expect(r.org_name).toBe("Acme");
  });

  it("uses deterministicOverride when supplied (T2 skip)", async () => {
    const r = await handlePillar1({
      org_name: "Acme",
      raw_input: "https://acme.example",
      deterministicOverride: {
        org_name: "Acme",
        company_context: "Workflow automation for ops teams.",
        has_product: true,
        industry_hint: "b2b_saas",
        business_model_hint: "subscription",
        raw_input: "https://acme.example",
      },
    });
    expect(r.company_context).toMatch(/workflow automation/i);
    expect(r.industry_hint).toBe("b2b_saas");
    expect(r.enriched_at).toBeTruthy();
  });
});
