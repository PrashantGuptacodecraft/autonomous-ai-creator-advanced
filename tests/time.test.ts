import { describe, expect, it } from "vitest";
import { deterministicDelaySeconds } from "@/lib/utils/time";

 describe("autonomous cadence", () => {
  it("is deterministic and remains inside configured bounds", () => {
    const first = deterministicDelaySeconds("agt_1", 4, 7200, 14400);
    const second = deterministicDelaySeconds("agt_1", 4, 7200, 14400);
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(7200);
    expect(first).toBeLessThanOrEqual(14400);
  });
});
