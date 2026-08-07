import { z } from "zod";

export const candidateScoresSchema = z.object({
  personaRelevance: z.number().min(0).max(100),
  practicalImpact: z.number().min(0).max(100),
  timeliness: z.number().min(0).max(100),
  novelty: z.number().min(0).max(100),
  evidenceQuality: z.number().min(0).max(100),
  audienceUsefulness: z.number().min(0).max(100),
  sourceIndependence: z.number().min(0).max(100),
  claimVerifiability: z.number().min(0).max(100),
  hypePenalty: z.number().min(0).max(100),
  repetitionPenalty: z.number().min(0).max(100),
  total: z.number().min(0).max(100),
});

export const editorialBatchSchema = z.object({
  decisions: z.array(z.object({
    candidateId: z.string(),
    decision: z.enum(["PUBLISH", "REJECT", "HOLD", "MERGE", "DUPLICATE"]),
    reason: z.string().min(20).max(1_200),
    whyNow: z.string().max(1_000),
    comparison: z.string().max(1_200),
    confidence: z.number().min(0).max(1),
    scores: candidateScoresSchema,
  })),
  selectedCandidateId: z.string().nullable(),
  cycleSummary: z.string().min(20).max(1_500),
});

export const draftPostSchema = z.object({
  text: z.string().min(120).max(1_800),
  rationale: z.string().min(100).max(1_800),
  claims: z.array(z.object({
    claim: z.string().min(10).max(500),
    sourceUrls: z.array(z.string().url()).min(1),
    confidence: z.number().min(0).max(1),
  })).min(1).max(10),
  editorialAngle: z.string().min(20).max(500),
  uncertainties: z.array(z.string().min(5).max(400)).max(6),
  narrativeTitle: z.string().min(3).max(120),
  narrativePosition: z.string().min(20).max(700),
  tags: z.array(z.string().min(2).max(40)).min(1).max(8),
});

export const verificationSchema = z.object({
  approved: z.boolean(),
  personaConsistency: z.number().min(0).max(100),
  evidenceCoverage: z.number().min(0).max(100),
  rationaleCompleteness: z.number().min(0).max(100),
  sourceIntegrity: z.number().min(0).max(100),
  unsupportedClaims: z.array(z.string().max(500)).max(10),
  personaDriftFlags: z.array(z.string().max(500)).max(10),
  revisionNotes: z.array(z.string().max(500)).max(10),
});

export const reflectionSchema = z.object({
  summary: z.string().min(30).max(1_200),
  priorities: z.array(z.string().min(5).max(300)).min(1).max(6),
});
