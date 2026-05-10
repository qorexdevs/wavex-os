/**
 * Explicit halt conditions the onboarding pipeline raises when a prerequisite
 * is missing and silent continuation would produce an unsafe manifest.
 *
 * These errors are caught by the server route handlers and mapped to specific
 * HTTP response shapes the UI can render as actionable halt screens.
 */

export type OnboardingHaltCode =
  | "BUDGET_ENFORCEMENT_UNAVAILABLE"
  | "URL_ENRICHMENT_UNMEANINGFUL"
  | "PILLAR_1_ENRICHMENT_FAILED";

export interface OnboardingHaltPayload {
  code: OnboardingHaltCode;
  /** Short, operator-facing message the UI will render verbatim. */
  operator_message: string;
  /** Engineer-level detail for logs and support tickets. */
  engineer_detail?: string;
  /** When true, the operator can click a button that bypasses the halt
   *  and proceeds at their own risk. Writes an anomaly flag to the QA record. */
  allow_override?: boolean;
}

export class OnboardingHaltError extends Error {
  readonly code: OnboardingHaltCode;
  readonly operator_message: string;
  readonly engineer_detail?: string;
  readonly allow_override: boolean;

  constructor(payload: OnboardingHaltPayload) {
    super(`[${payload.code}] ${payload.operator_message}${payload.engineer_detail ? ` · ${payload.engineer_detail}` : ""}`);
    this.name = "OnboardingHaltError";
    this.code = payload.code;
    this.operator_message = payload.operator_message;
    this.engineer_detail = payload.engineer_detail;
    this.allow_override = payload.allow_override ?? false;
  }

  toJSON(): OnboardingHaltPayload {
    return {
      code: this.code,
      operator_message: this.operator_message,
      engineer_detail: this.engineer_detail,
      allow_override: this.allow_override,
    };
  }
}

export function isOnboardingHaltError(err: unknown): err is OnboardingHaltError {
  return err instanceof OnboardingHaltError;
}
