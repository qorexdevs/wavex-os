/**
 * Pillar 5 — Communication Channel (phase-change: agent org merges with human).
 * Captures which channel the Board uses. Actual secret-binding for the chosen
 * channel happens in Phase 2 via the existing CONNECTOR_SPECS flow.
 */

import type {
  Pillar5Response,
  CommChannel,
  UrgencyRouting,
} from "../../schema/pillar-responses.js";

export interface Pillar5Input {
  comm_channel: CommChannel;
  comm_channel_other?: string;
  urgency_routing?: UrgencyRouting;
  urgency_routing_other?: string;
  board_endpoint_config?: Record<string, string>;
}

export async function handlePillar5(input: Pillar5Input): Promise<Pillar5Response> {
  // Email-only is a terminal branch — urgency routing is not applicable.
  const urgency = input.comm_channel === "email_only" ? undefined : input.urgency_routing;
  return {
    comm_channel: input.comm_channel,
    comm_channel_other: input.comm_channel_other,
    urgency_routing: urgency,
    urgency_routing_other: input.urgency_routing_other,
    board_endpoint_config: input.board_endpoint_config,
  };
}
