/**
 * WaveX OS onboarding-server client.
 *
 * The hosted backend (Phase D / E) provides:
 *   - server-side inference for the onboarding agent during free trial
 *   - System Optimizer scheduled prompt-injection (Phase F)
 *   - subscription / billing integration (Phase F)
 *
 * Phase B: this is a typed stub. Real network calls land in Phase D.
 */

export interface OnboardingSession {
  sessionId: string;
  companyName: string;
  industry: string;
  createdAt: string;
}

export interface InferenceRequest {
  sessionId: string;
  prompt: string;
  systemHint?: string;
  /** Limit per-request — server enforces 30K total per onboarding session. */
  maxOutputTokens?: number;
}

export interface InferenceResponse {
  text: string;
  /** Aggregate tokens used by this session so far. */
  totalTokensUsed: number;
  /** Soft cap (default 30,000). When exceeded, calls return 429. */
  totalTokensCap: number;
}

export interface SubscriptionTier {
  id: "trial" | "founder" | "growth" | "custom";
  name: string;
  monthlyUsd: number;
  injectionsPerDay: number;
  monthlyTokensIncluded: number;
}

export interface SystemOptimizerInjection {
  tierId: SubscriptionTier["id"];
  /** ISO timestamp of last successful injection. */
  lastInjectedAt: string | null;
  /** ISO timestamp of next scheduled injection. */
  nextScheduledAt: string | null;
  /** Tokens used this billing period. */
  tokensUsedPeriod: number;
}

/**
 * Default base URL for the WaveX OS hosted backend.
 * Phase D: replace with the production host (https://api.wavex-os.com).
 * Until then, calls are stubbed locally.
 */
export const DEFAULT_BASE_URL = "https://api.wavex-os.com";

export class OnboardingServerClient {
  constructor(
    public readonly baseUrl: string = DEFAULT_BASE_URL,
    public readonly apiKey?: string,
  ) {}

  /**
   * Phase D: POST /v1/onboarding/sessions
   */
  async createSession(_input: {
    companyName: string;
    industry: string;
  }): Promise<OnboardingSession> {
    throw new Error(
      "Phase B stub: hosted onboarding backend not yet live. Run the local Vite UI for the full Phase B experience.",
    );
  }

  /**
   * Phase D: POST /v1/onboarding/sessions/:sid/inference
   */
  async inference(_input: InferenceRequest): Promise<InferenceResponse> {
    throw new Error("Phase B stub: hosted inference not yet live.");
  }

  /**
   * Phase F: GET /v1/subscriptions/tiers
   */
  async listTiers(): Promise<SubscriptionTier[]> {
    return [
      { id: "trial", name: "Free Trial", monthlyUsd: 0, injectionsPerDay: 1, monthlyTokensIncluded: 200_000 },
      { id: "founder", name: "Founder", monthlyUsd: 29, injectionsPerDay: 1, monthlyTokensIncluded: 500_000 },
      { id: "growth", name: "Growth", monthlyUsd: 99, injectionsPerDay: 8, monthlyTokensIncluded: 2_000_000 },
      { id: "custom", name: "Custom", monthlyUsd: 299, injectionsPerDay: 24, monthlyTokensIncluded: 10_000_000 },
    ];
  }

  /**
   * Phase F: GET /v1/subscriptions/:companyId/optimizer
   */
  async getOptimizerStatus(_companyId: string): Promise<SystemOptimizerInjection> {
    throw new Error("Phase B stub: System Optimizer not yet live.");
  }
}

export default OnboardingServerClient;
