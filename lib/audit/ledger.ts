import { sha256 } from "@/lib/utils/ids";
import { stableJsonStringify } from "@/lib/utils/json";

export function computeAutonomyEventHash(input: {
  previousHash: string;
  eventType: string;
  occurredAt: Date | string;
  payload: Record<string, unknown>;
}): string {
  const occurredAt = new Date(input.occurredAt).toISOString();
  return sha256(
    `${input.previousHash}|${input.eventType}|${occurredAt}|${stableJsonStringify(input.payload)}`,
  );
}
