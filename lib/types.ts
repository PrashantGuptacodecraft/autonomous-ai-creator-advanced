export type AgentStatus =
  | "INITIALIZING"
  | "ACTIVE"
  | "COMPLETED"
  | "FAILED"
  | "PAUSED";

export type EditorialDecisionType =
  | "PUBLISH"
  | "REJECT"
  | "HOLD"
  | "MERGE"
  | "DUPLICATE";

export type SourceKind =
  | "official_blog"
  | "github_release"
  | "research"
  | "security_advisory"
  | "news_signal"
  | "community_signal"
  | "other";

export type SourceRole = "PRIMARY" | "CORROBORATING" | "DISCOVERY_SIGNAL";

export interface PersonaInput {
  name: string;
  domain: string;
}

export interface PersonaConstitution {
  identity: string;
  domain: string;
  mission: string;
  audience: string;
  interests: string[];
  editorialBeliefs: string[];
  voiceRules: string[];
  rejectionRules: string[];
  preferredStructure: string[];
  prohibitedPatterns: string[];
  version: number;
  hash: string;
}

export interface DiscoveredSource {
  externalId: string;
  title: string;
  url: string;
  canonicalUrl: string;
  hostname: string;
  publisherKey: string;
  summary: string;
  content: string;
  sourceName: string;
  sourceKind: SourceKind;
  sourceRole: SourceRole;
  publishedAt: Date | null;
  discoveredAt: Date;
  trustScore: number;
  metadata: Record<string, unknown>;
}

export interface StoryCluster {
  id: string;
  fingerprint: string;
  title: string;
  summary: string;
  primarySource: DiscoveredSource;
  sources: DiscoveredSource[];
  publishedAt: Date | null;
  independentSourceCount: number;
  corroborationScore: number;
  sourceDiversityScore: number;
  evidenceSummary: string;
}

export interface CandidateScores {
  personaRelevance: number;
  practicalImpact: number;
  timeliness: number;
  novelty: number;
  evidenceQuality: number;
  audienceUsefulness: number;
  sourceIndependence: number;
  claimVerifiability: number;
  hypePenalty: number;
  repetitionPenalty: number;
  total: number;
}

export interface EditorialCandidate {
  id: string;
  clusterId: string;
  sourceItemId: string;
  evidenceSourceItemIds: string[];
  sourceUrls: string[];
  title: string;
  summary: string;
  canonicalUrl: string;
  sourceName: string;
  sourceKind: SourceKind;
  publishedAt: Date | null;
  trustScore: number;
  independentSourceCount: number;
  corroborationScore: number;
  evidenceSummary: string;
  fingerprint: string;
  scores: CandidateScores;
}

export interface EditorialDecision {
  candidateId: string;
  decision: EditorialDecisionType;
  reason: string;
  whyNow: string;
  comparison: string;
  confidence: number;
  scores: CandidateScores;
}

export interface EvidenceClaim {
  claim: string;
  sourceUrls: string[];
  confidence: number;
}

export interface DraftPost {
  text: string;
  rationale: string;
  claims: EvidenceClaim[];
  editorialAngle: string;
  uncertainties: string[];
  narrativeTitle: string;
  narrativePosition: string;
  tags: string[];
}

export interface VerificationResult {
  approved: boolean;
  personaConsistency: number;
  evidenceCoverage: number;
  rationaleCompleteness: number;
  sourceIntegrity: number;
  unsupportedClaims: string[];
  personaDriftFlags: string[];
  revisionNotes: string[];
}

export interface QualityGateResult {
  passed: boolean;
  score: number;
  failures: string[];
  warnings: string[];
  metrics: {
    sourceCoverage: number;
    rationaleCompleteness: number;
    personaConsistency: number;
    evidenceCoverage: number;
    sourceIntegrity: number;
  };
}

export interface EvidenceSourceRecord {
  id: string;
  title: string;
  canonical_url: string;
  summary: string;
  content: string;
  source_name: string;
  source_kind: SourceKind;
  source_role: SourceRole;
  trust_score: number;
  published_at: string | Date | null;
  metadata: Record<string, unknown> | string;
}

export interface FeedPost {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
}

export interface CycleResult {
  cycleNumber: number;
  discovered: number;
  clustered: number;
  rejected: number;
  held: number;
  publishedPostId: string | null;
  qualityScore: number | null;
  status: "PUBLISHED" | "SKIPPED" | "FAILED";
  reason: string;
}

export interface AiAudit {
  purpose: "EDITORIAL" | "WRITING" | "VERIFICATION" | "REFLECTION" | "EMBEDDING";
  model: string;
  fallbackIndex: number;
  latencyMs: number;
  usage: Record<string, unknown>;
  success: boolean;
  error?: string;
}
