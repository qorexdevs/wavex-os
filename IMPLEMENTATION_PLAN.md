# Implementation Plan — Demo-Scope: Pricing Screen

**Status:** Plan mode. No code changes in this document.
**Branch:** `feat/op-omega-fidelity` (PR #3 open).
**Scope:** Build the Pricing screen as a wizard step between Materialize-bridge and Paperclip-handoff. Everything else from the original prompt — Snapshot/Port, WaveX Agent, Flash-out, Demo Mode, Twilio integration — is deferred to a post-demo backlog at the bottom of this document.

---

## 1. Discovery findings

### 1.1 Pricing screen — no source file in this repo

You showed me a rendered pricing screen ("System Optimizer subscription" header, 4 cards). I searched the repo and **the source for that screen doesn't exist in `/Users/dylanriedweg/wavex-os`** — only a stray reference to "System Optimizer daily injections" in `packages/onboarding-ui/src/pages/MissionControl.tsx`. The exact 4-card layout shown in the screenshot is not in source control.

**Conclusion:** I design the pricing page from scratch in this repo, using your screenshot as the authoritative design source.

### 1.2 Wizard flow today (relevant context)

The current wavex onboarding sequence in `packages/onboarding-ui/src/op-omega/OmegaOnboarding.tsx`:

```
welcome → pillar-1 → pillar-2 → pillar-3 → pillar-4 → pillar-5
        → phase-2-connectors → credential-concierge
        → phase-3-swarm → phase-4-workflows
        → materialize
```

In `materialize`, the operator clicks **Activate fleet →**, which today does **three things at once** in `activateAndNavigate()`:
1. POST `/api/instance/:id/activate` — bridges to wavex DB (35 agents written)
2. Reads `r.paperclipHandoff` from the response, calls `window.open(paperclipUiUrl, "_blank")` if a new agent was created
3. Renders the sticky-footer status + lets the operator click "Open Mission Control →"

For the demo, **the pricing screen inserts between step 1 and step 2**. The split:

```
[Activate fleet] → wavex DB bridge only
                        ↓
                  Pricing screen
                  (Subscribe / Skip)
                        ↓
                  Paperclip handoff fires + new tab opens to localhost:5174
                        ↓
                  Mission Control redirect
```

### 1.3 No existing tier infrastructure

No `tier_subscriptions` table, no `TierConfig` const, no enforcement middleware. Building from scratch in the most minimal way that makes the screen work.

---

## 2. Execution plan

Two new files, one modified file. That's it.

### 2.1 `packages/op-omega-server/src/config/pricing.ts` — new

The single source of truth for tier copy + structure. Server-side so the same const can power both the Pricing screen and (eventually) tier enforcement.

```ts
export interface TierConfig {
  id: 'trial' | 'founder' | 'growth' | 'custom';
  displayName: string;
  priceLabel: string;          // "$0 / 14 days", "$29 / month", ...
  priceCents: number;          // 0, 2900, 9900, 29900
  features: string[];          // checkmark lines, in order
  recommended: boolean;        // → "Most popular" badge
  ctaLabel: string;            // "Start trial" | "Subscribe"
}

export const TIERS: TierConfig[] = [
  {
    id: 'trial',
    displayName: 'Free trial',
    priceLabel: '$0 / 14 days',
    priceCents: 0,
    features: [
      '14 prompt injections',
      'Trial capacity (200K tokens)',
      'Full live preview',
    ],
    recommended: false,
    ctaLabel: 'Start trial',
  },
  {
    id: 'founder',
    displayName: 'Founder',
    priceLabel: '$29 / month',
    priceCents: 2900,
    features: [
      '30 prompt injections / mo',
      'Solo founder capacity (500K tokens / mo)',
      'Weekly performance audit',
    ],
    recommended: true,
    ctaLabel: 'Subscribe',
  },
  {
    id: 'growth',
    displayName: 'Growth',
    priceLabel: '$99 / month',
    priceCents: 9900,
    features: [
      '200 prompt injections / mo',
      'Team capacity (2M tokens / mo)',
      'Daily performance enforcement',
    ],
    recommended: false,
    ctaLabel: 'Subscribe',
  },
  {
    id: 'custom',
    displayName: 'Custom',
    priceLabel: '$299 / month',
    priceCents: 29900,
    features: [
      'Unlimited prompt injections',
      'Enterprise capacity (unlimited tokens)',
      'Dedicated WaveX Agent',
      'White-glove launch + VC arm',
    ],
    recommended: false,
    ctaLabel: 'Subscribe',
  },
];
```

### 2.2 `packages/op-omega-server/src/routes/tiers.ts` — new

Two endpoints. Both stubs for now.

```ts
// GET /api/tiers
// → { tiers: TierConfig[] }
// Pricing screen fetches this. Could be hardcoded in the frontend instead;
// using an endpoint keeps tier copy server-controlled and future-proof.

// POST /api/tier-subscriptions
// Body: { orgId: string, tierId: TierConfig['id'], origin: 'subscribe' | 'skip' }
// → { ok: true, tierId: string }
// Stub. Records the operator's choice for the demo. No charge.
// "skip" maps to tierId='trial'.
// Logs to console for now; once a real billing pass ships, this becomes
// the Stripe Checkout entry point.
```

The POST handler doesn't write to a DB table yet — for the demo, it just acknowledges and lets the wizard advance. When tier enforcement ships later, this is where the `tier_subscriptions` row gets created.

### 2.3 `packages/onboarding-ui/src/op-omega/pricing/Pricing.tsx` — new

Designed from the screenshot. Renders a 3-column grid with the 4th tier (Custom) wrapping to row 2, matching the layout in the image.

Component sketch:

```tsx
interface PricingProps {
  companyId: string;
  onContinue: (chosenTierId: TierConfig['id'], origin: 'subscribe' | 'skip') => void;
}

export function Pricing({ companyId, onContinue }: PricingProps) {
  const { data: tiers } = useQuery({
    queryKey: ['tiers'],
    queryFn: () => fetch('/api/tiers').then(r => r.json()).then(j => j.tiers),
  });

  async function handleChoice(tierId: TierConfig['id'], origin: 'subscribe' | 'skip') {
    await fetch('/api/tier-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: companyId, tierId, origin }),
    });
    onContinue(tierId, origin);
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
      <H2>System Optimizer subscription</H2>
      <P>Strategic prompt injections to your CEO. Your WaveX Agent monitors performance and intervenes when agents drift.</P>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '2rem' }}>
        {tiers?.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            onChoose={() => handleChoice(tier.id, 'subscribe')}
          />
        ))}
      </div>

      {/* Skip button — bottom-right, less prominent than Subscribe */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
        <button
          className="secondary"
          onClick={() => handleChoice('trial', 'skip')}
        >
          Skip — continue without subscription →
        </button>
      </div>
    </div>
  );
}
```

`TierCard` is a small subcomponent in the same file rendering:
- displayName as a title
- priceLabel
- bulleted feature list with green checkmarks (matching screenshot)
- ctaLabel button at bottom
- "Most popular" pill above the card when `tier.recommended === true`

Design notes for matching the screenshot exactly:
- Dark surface (`var(--surface)`) for cards, rounded corners (~8px), border (`var(--border)`)
- Most-popular card: blue accent border (`var(--accent)`) + filled blue Subscribe button
- Non-popular cards: outline border, transparent Subscribe button
- Green checkmark icon before each feature line (`✓` or a small SVG)
- Price uses size-mismatch: `$29` large/bold, `/ month` small/dim — same as screenshot

### 2.4 `packages/onboarding-ui/src/op-omega/phases/Materialize.tsx` — modify

The current `activateAndNavigate()` runs bridge + handoff + window.open() in one shot. Split it:

```tsx
// CURRENT (simplified):
async function activateAndNavigate() {
  const r = await opOmegaOnboardingApi.activate(companyId);  // bridges + handoffs server-side
  setActivated(r.inserted);
  setHandoff({ ... });
  if (r.paperclipHandoff.created.length > 0) {
    window.open(paperclipUiUrl(r.paperclipHandoff.paperclipUrl), '_blank', 'noopener');
  }
  // Operator clicks "Open Mission Control →" to advance
}

// NEW:
async function activateOnly() {
  const r = await opOmegaOnboardingApi.activate(companyId);  // still runs bridge + handoff server-side
  setActivated(r.inserted);
  setHandoff({ ... });
  setPendingPaperclipUrl(r.paperclipHandoff.paperclipUrl);  // hold the URL, don't open yet
  onAdvanceToPricing();  // tell OmegaOnboarding to render the Pricing phase
}

// After Pricing returns (in OmegaOnboarding's handler):
function proceedFromPricing(chosenTierId, origin) {
  if (pendingPaperclipUrl) {
    window.open(paperclipUiUrl(pendingPaperclipUrl), '_blank', 'noopener');
  }
  navigate(`/?companyId=${companyId}`);  // Mission Control
}
```

Note: the server-side handoff already fired during `activate()`. The split is purely about WHEN we open the Paperclip tab + WHEN we redirect — to give the operator a moment to review pricing in between.

### 2.5 `packages/onboarding-ui/src/op-omega/OmegaOnboarding.tsx` — modify

Add `"pricing"` to the `Phase` union and to `VALID_PHASES`. Wire it into the phase-switch render block:

```tsx
type Phase = ... | "materialize" | "pricing";

// ... in the render ...
{phase === "materialize" && (
  <Materialize
    companyId={companyId}
    onAdvanceToPricing={() => advance("pricing")}
  />
)}
{phase === "pricing" && (
  <Pricing
    companyId={companyId}
    onContinue={(tierId, origin) => {
      // proceedFromPricing logic — open Paperclip tab + navigate to Mission Control
      const pendingUrl = /* read from sessionStorage or pass through state */;
      if (pendingUrl) window.open(paperclipUiUrl(pendingUrl), '_blank', 'noopener');
      navigate(`/?companyId=${encodeURIComponent(companyId)}`);
    }}
  />
)}
```

State threading: the `paperclipUrl` from the activate response needs to survive the phase transition from `materialize` → `pricing`. Cleanest path: store on `sessionStorage` keyed by companyId in Materialize, read in Pricing's `proceedFromPricing`. (Alternative: pass via React state up to OmegaOnboarding — more typing but cleaner data flow.)

---

## 3. Execution checklist

In order:

1. Create `packages/op-omega-server/src/config/pricing.ts` with the 4 tier configs above
2. Create `packages/op-omega-server/src/routes/tiers.ts` with GET + POST endpoints (stubs)
3. Register the new route in `packages/op-omega-server/src/index.ts`
4. Add `pricing` API client method to `packages/onboarding-ui/src/op-omega/lib/api.ts`
5. Create `packages/onboarding-ui/src/op-omega/pricing/Pricing.tsx` + `TierCard` subcomponent
6. Modify `packages/onboarding-ui/src/op-omega/phases/Materialize.tsx` — split activate from open-Paperclip
7. Modify `packages/onboarding-ui/src/op-omega/OmegaOnboarding.tsx` — add `pricing` phase + route through it
8. Visual QA — refresh `localhost:5173`, walk to Materialize, click Activate → verify the Pricing screen appears, Subscribe + Skip both advance correctly with the Paperclip tab opening at the right moment
9. Update `e2e/_demo-ricoma.spec.ts` — add a step that asserts the Pricing screen appears + clicks Skip to advance (avoids the test being broken by the new step)

Estimated total: **3-4 hours of focused work** for a single executor. Mostly UI; backend is two tiny endpoints.

---

## 4. Env vars

None required for this scope.

(The original plan named env vars for WaveX model selection, flash-out, magic links — all deferred.)

---

## 5. Test strategy

Light, demo-focused:

- **Unit test** for `TIERS` const integrity (every tier has all required fields, prices match labels). One vitest file in `packages/op-omega-server/test/pricing-config.test.ts`.
- **E2E spec update** to `e2e/_demo-ricoma.spec.ts`: assert the Pricing screen renders the 4 cards with the right copy + the Skip button advances cleanly to Mission Control.
- **Manual smoke**: full wizard walk on localhost — fresh company, walk to Activate, see Pricing, click Subscribe on Founder → confirm Mission Control redirect + Paperclip tab opens.

That's it. No tier enforcement to test (deferred). No webhook idempotency, redaction, magic-link flow (all deferred).

---

## 6. Rollout

For the demo, ship straight to the `feat/op-omega-fidelity` branch + push to fork. Open a PR comment on #3 noting the new pricing step.

No feature flag. The pricing screen always renders between Materialize-bridge and Paperclip-handoff. The Skip button means the screen never blocks a demo from completing.

---

## 7. Post-demo backlog (deferred — DO NOT BUILD NOW)

These were detailed plans in v1 of this document and are preserved here so the thinking isn't lost. **None of them are in scope for the demo.** Revisit after the demo lands.

### 7.1 Tier enforcement (Feature 5 — partial)

When real billing ships, the stub `POST /api/tier-subscriptions` becomes the Stripe Checkout entry point. The plan needs:
- `tier_subscriptions` table (Drizzle migration)
- `prompt_injection_usage` table for tracking
- `requireTier(minTier)` + `requireFeature(feature)` middleware
- `GET /api/usage/current-period` rollup endpoint
- Hard-cap behavior at 100% (warning) and 110% (block) — already partially built via `BudgetExhaustedError`
- Over-limit banner UI in Mission Control

### 7.2 WaveX Agent (Feature 2 — entire)

Deferred entirely.

When picked up:
- WaveX is **NOT** a kernel slot in the swarm (decided previous review). It's a SaaS-side concierge agent.
- Lives behind `/api/wavex/*` endpoints, accessed from the customer's board UI
- Uses tier-router → claude CLI (consistent with our token accounting), NOT `@anthropic-ai/sdk` direct
- Per-trigger model selection via env vars (`WAVEX_DEFAULT_MODEL`, `WAVEX_WEBHOOK_MODEL`, etc.)
- Webhook listener for agent lifecycle events (idle, deliverable-missed, error-loop, token-runaway) — but the upstream emitter doesn't exist yet either, so the heartbeat-polling synthesizer needs to be built first
- Scheduled audit jobs by tier (weekly for Founder, daily for Growth, none for Custom — Custom is real-time)
- Visual UI: sidebar/overlay on Mission Control, NOT in the FleetGraph

### 7.3 Snapshot + Port infrastructure (Feature 1 — entire)

Deferred entirely.

When picked up: `FleetSnapshot` interface, `instance_snapshots` table, four `/api/port/*` endpoints (get / capture / inject / health), per-actor audit scoping. Used by WaveX (#7.2) and flash-out (#7.4) — neither of which is shipping now.

### 7.4 Data flash-out to KB (Feature 3 — entire)

Deferred entirely.

When picked up: write-path-only event log to S3 (already available via `@aws-sdk/client-s3` in core) with Postgres fallback; deterministic-regex PII redaction; per-org consent toggle in settings. No KB query layer — that's a separate project.

### 7.5 Demo mode (Feature 4 — entire)

Deferred entirely. Current onboarding flow IS the demo — no separate "operator-driven demo orgs + magic-link handoff" wrapper needed. If the team later wants real prospect-handoff (live conversation → claimable manifest), come back to the v1 plan.

### 7.6 Twilio integration — never in scope

The original prompt listed Twilio in the STACK description, but no feature in the prompt actually used Twilio and no Twilio code exists in this repo. Dropped from the plan entirely. If SMS-based magic links or voice features come up later, that's a fresh project.

---

## 8. Open questions

Only one matters for the demo-scope work:

### Q1. Pricing screen design fidelity to the screenshot

The screenshot you shared has specific styling — blue Most-popular badge, blue Subscribe button on Founder card only, green checkmark icons, "$29" large / "/ month" small typography. **Do you want pixel-perfect match, or directional match (right copy + structure, but adapt to the wavex dark theme + component primitives)?**

I'd recommend **directional match using the existing component primitives** (`Card`, `H2`, `P`, `Field`) so the pricing screen feels like the rest of the wizard rather than a one-off. Pixel-perfect would need a custom design system extraction.

Confirm "directional" and I'll proceed with execution. Or paste a CSS spec / Figma link and I'll match exactly.
