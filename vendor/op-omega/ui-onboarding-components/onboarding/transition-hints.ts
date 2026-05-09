/**
 * Shared store for transition hints emitted after each pillar submission.
 * Used by Pillar 4 + 5 to apply server-driven option modifications.
 */

import type { QuestionModification } from "../../../api/opOmegaOnboarding";

export const transitionHints: { current: QuestionModification[] } = { current: [] };

export function consumeHint(question_id: string): QuestionModification | undefined {
  return transitionHints.current.find((m) => m.question_id === question_id);
}

export function applyHintToOptions<T extends { v: string }>(
  options: readonly T[],
  hint?: QuestionModification,
): T[] {
  if (!hint) return [...options];
  let out = [...options];
  if (hint.option_hidden) out = out.filter((o) => !hint.option_hidden!.includes(o.v));
  if (hint.option_reorder) {
    const order = hint.option_reorder;
    out = out.sort((a, b) => {
      const ai = order.indexOf(a.v);
      const bi = order.indexOf(b.v);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  return out;
}
