import { describe, expect, it } from "vitest";
import { compilePersona } from "@/lib/editorial/persona";

 describe("persona compiler", () => {
  it("is deterministic and creates a stable constitution", () => {
    const input = { name: "Ada", domain: "AI Security" };
    const first = compilePersona(input);
    const second = compilePersona(input);
    expect(first.hash).toBe(second.hash);
    expect(first.domain).toBe("AI Security");
    expect(first.rejectionRules.length).toBeGreaterThanOrEqual(5);
  });
});
