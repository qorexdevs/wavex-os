import { test, expect } from "@playwright/test";

test("all interactive elements meet 44px touch target (iPhone 13)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173");
  const interactives = await page.$$("button, a, [role=button]");
  for (const el of interactives) {
    const box = await el.boundingBox();
    if (!box) continue;
    expect(Math.min(box.width, box.height), `element too small: ${await el.innerHTML()}`).toBeGreaterThanOrEqual(44);
  }
});
