/** Op-omega supplementary Fastify routes.
 *
 *  These routes extend the Paperclip core server (packages/core/server) with
 *  wavex-os–specific analytics, partner signals, and activation event tracking.
 *
 *  Mount with: registerOpOmegaRoutes(app) after core routes are registered. */

import type { FastifyInstance } from "fastify";
import { registerActivationEventsRoute } from "./routes/activation-events.js";
import { registerAuthEventsRoute } from "./routes/auth-events.js";
import { registerPartnerChecklistRoutes } from "./routes/partner-checklist.js";
import { registerPartnerEventsRoutes } from "./routes/partner-events.js";
import { registerSmokeTestEventsRoute } from "./routes/smoke-test-events.js";
import { registerUpsellSignalsRoutes } from "./routes/upsell-signals.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerWizardEventsRoute } from "./routes/wizard-events.js";

export function registerOpOmegaRoutes(app: FastifyInstance): void {
  registerActivationEventsRoute(app);
  registerAuthEventsRoute(app);
  registerPartnerChecklistRoutes(app);
  registerPartnerEventsRoutes(app);
  registerSmokeTestEventsRoute(app);
  registerUpsellSignalsRoutes(app);
  registerUserRoutes(app);
  registerWizardEventsRoute(app);
}
