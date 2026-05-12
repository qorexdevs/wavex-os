import type { FastifyInstance } from "fastify";

export async function registerHealth(app: FastifyInstance): Promise<void> {
  app.get("/v1/health", async () => ({
    status: "ok",
    service: "wavex-inference-server",
    version: "0.1.0",
    pools: ["A", "C"],
  }));
}
