# Chat-First Onboarding — UX Primitives

Documents the four reusable patterns introduced for the `/onboarding-chat` shell, so future refinements can reach for an existing primitive rather than reinvent the layout.

## 1. The chat spine

**File**: `packages/onboarding-ui/src/wavex-os/pages/OnboardingShell.tsx`

A persistent three-zone layout: top bar (sticky), scrollable message thread, fixed input. The thread auto-scrolls on new messages. The shell holds a single `useReducer` against `state/onboarding-reducer.ts`; phase transitions never trigger route navigation.

Each chat message is a `ChatMessage`:

```ts
{ id, role, text?, slot?, ts, collapsed? }
```

Where `role ∈ { user, assistant, system }` and `slot` (when present) tags the message for an inline-component handoff via `SlotRenderer`. Collapsing a message renders it as a one-line muted summary — used to "close" inline cards once the operator has answered them.

## 2. Tappable chips with fill-in (`ResponseChips`)

**File**: `packages/onboarding-ui/src/wavex-os/components/ResponseChips.tsx`

The unified replacement for every `<select>` and `RadioGroup` in the onboarding. Supports:

- `mode: "single" | "multi"` — multi caps via `maxSelections`.
- `allowCustom: true` — adds a dashed `+ Other` chip that swaps into an inline text input on click. Enter commits a custom value; Escape cancels. Custom values render with a `✎` prefix + `×` remove button. Multiple custom values are supported.
- Two separate state arrays: `values` (canonical) and `customValues` (free-text). The caller chooses how to serialize. Convention:
  - **Pillar 1 industry/business_model**: the canonical hint is a free-text field, so custom replaces canonical entirely.
  - **Pillars 3-5**: the canonical enum includes an `"other"` slot. Caller maps a non-empty `customValues[0]` to `{ field: "other", field_other: customValues[0] }`.

For genuinely-singular fields (`product_state`, `sales_motion`, `comm_channel`, `has_product`), pass `mode="single"`. Multi is reserved for fields whose schema accepts arrays (currently only `lead_sources`). Custom fill-in is universally available.

## 3. Inline cards inside chat bubbles

**Files**: `packages/onboarding-ui/src/wavex-os/components/inline-cards/*`

When the chat needs more than text — a confirmation form, a multi-question prompt, an option picker — the assistant emits a `ChatMessage` with a `slot` tag, and `SlotRenderer` mounts the bound component inside the message bubble. Examples:

- `Pillar1ConfirmCard` — three ResponseChips groups + a CTA
- `Pillar3/4/5PromptCard` — conditional follow-up questions in one card
- `ConnectorPickerCard` — three bucketed lists + re-refine + confirm

Cards live INSIDE the bubble (same surface as the text), so the operator's eye stays in the conversation flow. Bubbles with slots widen to `maxWidth: 95%` (vs `85%` for text-only) so embedded grids breathe.

When the operator confirms a card, the parent dispatches an action that BOTH advances the reducer AND collapses the original card message (`COLLAPSE_MESSAGE`). The card becomes a one-line muted summary in the thread's history — visible audit trail, gone from the visual focus.

## 4. The slide-up drawer

**File**: `packages/onboarding-ui/src/wavex-os/components/CredentialDrawer.tsx`

For operations that require focused attention but shouldn't kick the operator out of the conversation — credentials are the prototypical example. The drawer is `position: fixed; inset: 0` with a backdrop that dims the chat behind it. The drawer panel pins to the bottom (`align-items: flex-end`) and grows up to `max-height: 85vh`. Backdrop click dismisses; explicit `Done` advances the reducer phase. The chat thread is preserved underneath and re-emerges intact when the drawer closes.

## 5. The earned full-screen reveal

**Files**: `pages/SwarmStudio.tsx`, `pages/ImprintTheater.tsx`, `pages/ActivateProgress.tsx`

Reserved for moments where the operator is making a consequential decision (Swarm Studio) or where the system is delivering the emotional payoff (Imprint Theater + activate). The full-screen layer sits at `z-index: 60-90` over everything else, including the chat. There is no "minimize" — the operator either confirms or backs out explicitly. The chat is still there when the reveal dismisses, with the conversation history intact.

Three earned-reveal slots exist:
1. **Swarm Studio** (`z-index: 60`) — 35-node OrgGraph + add/swap panels, sticky footer with the workflow-prefetch-triggering CTA.
2. **Imprint Theater** (`z-index: 70`) — three sequential acts (MC race → winner reveal → streaming imprint), black background, dramatic typography.
3. **Activate Progress** (`z-index: 90`) — slot-by-slot hire animation, single CTA to launch into Mission Control.

The pricing dialog (`z-index: 80`) is NOT a full-screen reveal — it's a centered card over a dimmed Theater backdrop, briefly interrupting before activate begins.

## 6. The progress bubble

**Component reused as-is**: `T2ProgressIndicator`

When the assistant says "thinking" (T2 in flight), the bubble carries `slot: { kind: "thinking", phase: "..." }` and `SlotRenderer` mounts `T2ProgressIndicator` inline. The indicator polls `/api/inference/current` driven by `wavex-claude-spawn.sh` heartbeats — **real elapsed milliseconds**, not a fake stage simulator. This is the single most important UX win in the refactor; never replace it with synthetic stages.

## Reducer & slot context

The slot context plumbed through `ChatThread → ChatBubble → SlotRenderer` carries:
- `companyId`, `orgName`, `rawInput` — for resubmissions (Pillar 1 halt recovery).
- Pillar/phase confirmation handlers — `onPillar1Confirmed`, `onPillar3Done`, etc. Each dispatches the next phase + emits the next assistant turn as a new chat message.

This keeps the cards stateless from the reducer's perspective: a card just reports its result via a callback. The reducer + shell orchestrate the conversation around it.

## Non-goals

- Cross-tab persistence of the conversation. Reloading the page loses the chat. v2.
- Streaming server-sent events from the imprint. We simulate the stream at ~60 chars/sec on the client. The backend returns the whole imprint in one response.
- Live progressive activate. v1 single-batches; the slot-by-slot animation is cosmetic.
