import { describe, expect, it } from "vitest";
import { compilePersona } from "@/lib/editorial/persona";
import { deterministicVerification, evaluateQualityGate } from "@/lib/editorial/quality";
import type { DraftPost } from "@/lib/types";

const persona = compilePersona({ name: "Mira", domain: "AI Systems Reliability" });
const url = "https://example.com/release";

const draft: DraftPost = {
  text: "The important part of this release is not the headline feature. It is the addition of durable recovery controls that reduce the number of failure states teams must handle manually.\n\nThe official release notes describe persisted execution and retry behavior. My view is that teams should evaluate recovery semantics and observability before changing production architecture.",
  rationale: "Selected because the story cleared the evidence and practical-impact threshold. It is relevant now because the official release was published today. The source basis is the linked release documentation. It was chosen over other candidates with weaker evidence and less concrete operational impact.",
  claims: [{ claim: "The release documentation describes persisted execution and retry behavior.", sourceUrls: [url], confidence: 0.9 }],
  editorialAngle: "Durability matters more than the headline feature.",
  uncertainties: [],
  narrativeTitle: "Durable agent execution",
  narrativePosition: "Recovery semantics are becoming core agent infrastructure.",
  tags: ["AI reliability"],
};

describe("publication quality gate", () => {
  it("passes a sourced, transparent, in-persona draft", () => {
    const verification = deterministicVerification({ draft, persona, allowedSourceUrls: [url] });
    const result = evaluateQualityGate({
      draft,
      verification,
      persona,
      allowedSourceUrls: [url],
      recentPosts: [],
      minimumScore: 80,
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("rejects claims that cite unverified URLs", () => {
    const bad = { ...draft, claims: [{ ...draft.claims[0]!, sourceUrls: ["https://untrusted.example/claim"] }] };
    const verification = deterministicVerification({ draft: bad, persona, allowedSourceUrls: [url] });
    const result = evaluateQualityGate({
      draft: bad,
      verification,
      persona,
      allowedSourceUrls: [url],
      recentPosts: [],
      minimumScore: 80,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toMatch(/claim URLs|mapped/i);
  });
});
