/**
 * WaveX OS Inference Server (Phase G.3)
 *
 * Mac-hosted Fastify proxy for:
 *   - Pool A: anonymous, rate-limited onboarding T2 (wizard's enrichment)
 *   - Pool C: JWT-gated optimizer inference (subscription-paid)
 *
 * Binds 127.0.0.1:8787 ONLY. Public surface via Cloudflare Tunnel
 * (cloudflared) terminating at api.wavex-os.com.
 *
 * Deploy via the launchd plist at templates/launchd/com.wavex-os.inference-server.plist.tmpl.
 *
 * Resource constraints (Phase G.1 + G.2):
 *   The inference-server respects platform-level kill switches:
 *   - If wavex_os.platform_config['inference_freeze']='true', all routes 503
 *   - If daily ledger > daily_cap_cents, Pool A returns 503 with Retry-After
 *   - The System Reliability agent's resource sweep can flip the freeze via
 *     /admin/freeze
 */
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerHealth } from "./routes/health.js";
import { registerOnboarding } from "./routes/onboarding.js";
import { registerOptimizer } from "./routes/optimizer.js";
import { registerAdmin } from "./routes/admin.js";

const PORT = Number(process.env.WAVEX_INFERENCE_PORT ?? 8787);
const HOST = process.env.WAVEX_INFERENCE_HOST ?? "127.0.0.1";

async function main(): Promise<void> {
  const app: FastifyInstance = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    bodyLimit: 256 * 1024, // 256 KB — onboarding payloads are small
    trustProxy: true,      // cloudflared sets X-Forwarded-For
  });

  await registerHealth(app);
  await registerOnboarding(app);
  await registerOptimizer(app);
  await registerAdmin(app);

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: "not_found" });
  });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error({ err }, "request failed");
    reply.code(500).send({ error: "internal" });
  });

  try {
    const addr = await app.listen({ port: PORT, host: HOST });
    app.log.info(`wavex-inference-server listening on ${addr}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      app.log.info(`got ${sig}, shutting down`);
      await app.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
