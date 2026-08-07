import type {
  DraftPost,
  PersonaConstitution,
  QualityGateResult,
  VerificationResult,
} from "@/lib/types";
import type { RecentPostMemory } from "@/lib/db/repository";
import { jaccardSimilarity } from "@/lib/utils/text";

const HYPE = /\b(revolutionary|game[- ]changing|mind[- ]blowing|will change everything|insane|unprecedented)\b/i;
const WHY_NOW = /\b(now|today|this week|recent|newly|current|just released|published|announced)\b/i;
const SELECTION = /\b(selected|chosen|worth publishing|met the threshold|cleared)\b/i;
const COMPARISON = /\b(over|instead of|other candidate|alternative|weaker|compared with|competing)\b/i;
const SOURCE_BASIS = /\b(source|evidence|release notes|documentation|paper|advisory|official)\b/i;

export function evaluateQualityGate(input: {
  draft: DraftPost;
  verification: VerificationResult;
  persona: PersonaConstitution;
  allowedSourceUrls: string[];
  recentPosts: RecentPostMemory[];
  minimumScore: number;
}): QualityGateResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const allowed = new Set(input.allowedSourceUrls);
  const cited = new Set(input.draft.claims.flatMap((claim) => claim.sourceUrls));
  const invalidUrls = [...cited].filter((url) => !allowed.has(url));
  const supportedClaims = input.draft.claims.filter((claim) =>
    claim.sourceUrls.length > 0 && claim.sourceUrls.every((url) => allowed.has(url)),
  ).length;
  const sourceCoverage = input.draft.claims.length
    ? Math.round((supportedClaims / input.draft.claims.length) * 100)
    : 0;

  let rationalePoints = 0;
  if (SELECTION.test(input.draft.rationale)) rationalePoints += 25;
  if (WHY_NOW.test(input.draft.rationale)) rationalePoints += 25;
  if (SOURCE_BASIS.test(input.draft.rationale)) rationalePoints += 25;
  if (COMPARISON.test(input.draft.rationale)) rationalePoints += 25;

  const maxRecentSimilarity = input.recentPosts.reduce(
    (max, post) => Math.max(max, jaccardSimilarity(input.draft.text, post.text)),
    0,
  );

  if (input.draft.text.length < 180 || input.draft.text.length > 1_800) failures.push("Post length is outside the publication range.");
  if (input.draft.rationale.length < 120) failures.push("Rationale is too short to explain the decision transparently.");
  if (input.draft.claims.length === 0) failures.push("The draft contains no claim-to-source evidence.");
  if (invalidUrls.length > 0) failures.push("One or more claim URLs are not in the verified evidence bundle.");
  if (sourceCoverage < 100) failures.push("Not every factual claim is mapped to approved evidence.");
  if (rationalePoints < 100) failures.push("Rationale does not cover selection, timeliness, source basis, and comparison.");
  if (HYPE.test(input.draft.text)) failures.push("Draft contains prohibited hype language.");
  if ((input.draft.text.match(/#/g) ?? []).length > 2) warnings.push("The post contains unnecessary hashtag-like formatting.");
  if (maxRecentSimilarity >= 0.72) failures.push("Draft is too similar to a recently published post.");
  if (input.verification.unsupportedClaims.length > 0) failures.push("Verifier identified unsupported factual claims.");
  if (input.verification.personaDriftFlags.length > 0) warnings.push(...input.verification.personaDriftFlags);

  const score = Math.max(0, Math.min(100, Math.round(
    sourceCoverage * 0.25 +
      rationalePoints * 0.2 +
      input.verification.personaConsistency * 0.2 +
      input.verification.evidenceCoverage * 0.15 +
      input.verification.sourceIntegrity * 0.15 +
      Math.max(0, 100 - maxRecentSimilarity * 100) * 0.05 -
      failures.length * 8,
  )));

  return {
    passed: failures.length === 0 && score >= input.minimumScore,
    score,
    failures,
    warnings,
    metrics: {
      sourceCoverage,
      rationaleCompleteness: rationalePoints,
      personaConsistency: input.verification.personaConsistency,
      evidenceCoverage: input.verification.evidenceCoverage,
      sourceIntegrity: input.verification.sourceIntegrity,
    },
  };
}

export function deterministicVerification(input: {
  draft: DraftPost;
  persona: PersonaConstitution;
  allowedSourceUrls: string[];
}): VerificationResult {
  const allowed = new Set(input.allowedSourceUrls);
  const unsupportedClaims = input.draft.claims
    .filter((claim) => claim.sourceUrls.length === 0 || claim.sourceUrls.some((url) => !allowed.has(url)))
    .map((claim) => claim.claim);
  const personaDriftFlags = HYPE.test(input.draft.text) ? ["The draft uses promotional or exaggerated language."] : [];
  const rationaleCompleteness = [SELECTION, WHY_NOW, SOURCE_BASIS, COMPARISON]
    .filter((pattern) => pattern.test(input.draft.rationale)).length * 25;
  const evidenceCoverage = input.draft.claims.length
    ? Math.round(((input.draft.claims.length - unsupportedClaims.length) / input.draft.claims.length) * 100)
    : 0;
  const sourceIntegrity = unsupportedClaims.length === 0 ? 100 : Math.max(0, 100 - unsupportedClaims.length * 30);
  const personaConsistency = personaDriftFlags.length === 0 ? 84 : 58;
  return {
    approved: unsupportedClaims.length === 0 && rationaleCompleteness === 100 && personaDriftFlags.length === 0,
    personaConsistency,
    evidenceCoverage,
    rationaleCompleteness,
    sourceIntegrity,
    unsupportedClaims,
    personaDriftFlags,
    revisionNotes: [
      ...(rationaleCompleteness < 100 ? ["Explicitly cover selection, relevance now, source basis, and comparison."] : []),
      ...personaDriftFlags,
    ],
  };
}
