import { z } from "zod";

const booleanString = z
  .string()
  .optional()
  .transform((value: string | undefined) => value !== "false");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AI_GATEWAY_API_KEY: z.string().optional(),
  EDITORIAL_MODELS: z.string().default("openai/gpt-5.4-mini,google/gemini-3.5-flash"),
  WRITER_MODELS: z.string().default("openai/gpt-5.4-mini,anthropic/claude-sonnet-5"),
  VERIFIER_MODELS: z.string().default("google/gemini-3.5-flash,openai/gpt-5.4-mini"),
  EMBEDDING_MODELS: z.string().default("openai/text-embedding-3-small"),
  // Backward-compatible singular overrides.
  EDITORIAL_MODEL: z.string().optional(),
  WRITER_MODEL: z.string().optional(),
  VERIFIER_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  EXTRA_RSS_FEEDS: z.string().optional(),
  EXTRA_GITHUB_REPOS: z.string().optional(),
  FIRST_CYCLE_DELAY_SECONDS: z.coerce.number().int().min(0).default(45),
  MIN_CYCLE_DELAY_SECONDS: z.coerce.number().int().min(60).default(5400),
  MAX_CYCLE_DELAY_SECONDS: z.coerce.number().int().min(60).default(10800),
  MAX_AUTONOMOUS_CYCLES: z.coerce.number().int().min(1).max(100).default(36),
  EVALUATION_WINDOW_HOURS: z.coerce.number().int().min(1).max(168).default(50),
  MIN_POST_SPACING_MINUTES: z.coerce.number().int().min(1).default(135),
  MAX_POSTS_PER_DAY: z.coerce.number().int().min(1).max(24).default(6),
  MAX_DISCOVERED_ITEMS: z.coerce.number().int().min(10).max(250).default(80),
  MAX_EDITORIAL_CANDIDATES: z.coerce.number().int().min(1).max(30).default(12),
  MIN_PUBLICATION_SCORE: z.coerce.number().min(0).max(100).default(72),
  MIN_QUALITY_GATE_SCORE: z.coerce.number().min(0).max(100).default(80),
  SEMANTIC_DUPLICATE_THRESHOLD: z.coerce.number().min(0.5).max(0.99).default(0.86),
  SOURCE_FETCH_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(6),
  ALLOW_DEMO_FALLBACK: booleanString,
  ADMIN_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (!cachedConfig) cachedConfig = envSchema.parse(process.env);
  return cachedConfig;
}

function parseModels(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))];
}

export function getModelFallbacks(
  purpose: "EDITORIAL" | "WRITING" | "VERIFICATION" | "EMBEDDING",
): string[] {
  const config = getConfig();
  if (purpose === "EDITORIAL") {
    return parseModels(config.EDITORIAL_MODEL ?? config.EDITORIAL_MODELS);
  }
  if (purpose === "WRITING") {
    return parseModels(config.WRITER_MODEL ?? config.WRITER_MODELS);
  }
  if (purpose === "VERIFICATION") {
    return parseModels(config.VERIFIER_MODEL ?? config.VERIFIER_MODELS);
  }
  return parseModels(config.EMBEDDING_MODEL ?? config.EMBEDDING_MODELS);
}

export function resetConfigForTests(): void {
  cachedConfig = undefined;
}
