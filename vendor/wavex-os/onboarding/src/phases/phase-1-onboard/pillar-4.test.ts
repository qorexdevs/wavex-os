import { describe, expect, it } from "vitest";
import { deriveGtmProfile, handlePillar4 } from "./pillar-4.js";

describe("Pillar 4 · GTM derivation", () => {
  it("outbound + high-touch → OUTBOUND_HIGH_TOUCH_SAAS", () => {
    expect(
      deriveGtmProfile({ lead_sources: ["outbound_cold"], sales_motion: "high_touch_enterprise" }),
    ).toBe("OUTBOUND_HIGH_TOUCH_SAAS");
  });
  it("inbound + plg → INBOUND_PLG", () => {
    expect(
      deriveGtmProfile({ lead_sources: ["inbound_ads_meta_google"], sales_motion: "self_serve_plg" }),
    ).toBe("INBOUND_PLG");
  });
  it("referral → REFERRAL_LED regardless of motion", () => {
    expect(
      deriveGtmProfile({ lead_sources: ["referral_word_of_mouth"], sales_motion: "assisted_demo" }),
    ).toBe("REFERRAL_LED");
  });
  it("none_yet lead source → BOOTSTRAP_NO_GTM", () => {
    expect(
      deriveGtmProfile({ lead_sources: ["none_yet"], sales_motion: "self_serve_plg" }),
    ).toBe("BOOTSTRAP_NO_GTM");
  });
  it("exotic combo → CUSTOM", () => {
    expect(
      deriveGtmProfile({ lead_sources: ["other"], sales_motion: "other" }),
    ).toBe("CUSTOM");
  });
  it("product_led_viral → INBOUND_PLG", () => {
    expect(
      deriveGtmProfile({ lead_sources: ["product_led_viral"], sales_motion: "self_serve_plg" }),
    ).toBe("INBOUND_PLG");
  });
  it("partnerships → REFERRAL_LED", () => {
    expect(
      deriveGtmProfile({ lead_sources: ["partnerships"], sales_motion: "assisted_demo" }),
    ).toBe("REFERRAL_LED");
  });
  it("multi-select: primary (first) drives the gtm_profile_enum", () => {
    // content_seo + inbound_ads with plg → primary is content → CONTENT_LED_PLG
    expect(
      deriveGtmProfile({ lead_sources: ["content_seo", "inbound_ads_meta_google"], sales_motion: "self_serve_plg" }),
    ).toBe("CONTENT_LED_PLG");
    // Reversed primary → INBOUND_PLG
    expect(
      deriveGtmProfile({ lead_sources: ["inbound_ads_meta_google", "content_seo"], sales_motion: "self_serve_plg" }),
    ).toBe("INBOUND_PLG");
  });

  it("handler returns full response shape with lead_sources array + back-compat lead_source", async () => {
    const r = await handlePillar4({
      lead_sources: ["outbound_cold"],
      sales_motion: "high_touch_enterprise",
      close_channel: "mostly_phone_video",
    });
    expect(r.gtm_profile_enum).toBe("OUTBOUND_HIGH_TOUCH_SAAS");
    expect(r.close_channel).toBe("mostly_phone_video");
    expect(r.lead_sources).toEqual(["outbound_cold"]);
    expect(r.lead_source).toBe("outbound_cold");  // back-compat primary mirror
  });
});
