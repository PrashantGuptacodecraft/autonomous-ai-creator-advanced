import { describe, expect, it } from "vitest";
import { computeAutonomyEventHash } from "@/lib/audit/ledger";

const occurredAt = "2026-08-07T10:30:00.000Z";

describe("tamper-evident autonomy ledger", () => {
  it("produces stable hashes independent of payload key order", () => {
    const first = computeAutonomyEventHash({
      previousHash: "GENESIS",
      eventType: "AGENT_INITIALIZED",
      occurredAt,
      payload: { domain: "AI Security", name: "Ada" },
    });
    const second = computeAutonomyEventHash({
      previousHash: "GENESIS",
      eventType: "AGENT_INITIALIZED",
      occurredAt,
      payload: { name: "Ada", domain: "AI Security" },
    });
    expect(first).toBe(second);
  });

  it("changes when an event payload is modified", () => {
    const original = computeAutonomyEventHash({
      previousHash: "GENESIS",
      eventType: "POST_PUBLISHED",
      occurredAt,
      payload: { postId: "p1", qualityScore: 94 },
    });
    const tampered = computeAutonomyEventHash({
      previousHash: "GENESIS",
      eventType: "POST_PUBLISHED",
      occurredAt,
      payload: { postId: "p1", qualityScore: 95 },
    });
    expect(original === tampered).toBe(false);
  });
});
