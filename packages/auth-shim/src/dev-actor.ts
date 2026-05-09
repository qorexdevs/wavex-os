/** In dev mode, we synthesize a single-user local-implicit board actor that
 *  passes every assertion. The userId can be overridden via WAVEX_DEV_USER_ID
 *  for multi-user simulation. */
import type { BoardActor } from "./types.js";

export function getDevActor(): BoardActor {
  return {
    type: "board",
    source: "local_implicit",
    userId: process.env.WAVEX_DEV_USER_ID ?? "local-operator",
    isInstanceAdmin: true,
  };
}
