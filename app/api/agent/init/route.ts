import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import {
  attachWorkflowRun,
  createAgent,
  markAgentFailed,
  prepareAgentForWorkflow,
} from "@/lib/db/repository";
import { compilePersona } from "@/lib/editorial/persona";
import { autonomousCreatorWorkflow } from "@/workflows/autonomous-creator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const initSchema = z.object({
  persona: z.object({
    name: z.string().trim().min(2).max(80),
    domain: z.string().trim().min(2).max(120),
  }),
});

const TECH_TERMS = [
  "ai",
  "artificial intelligence",
  "machine learning",
  "technology",
  "software",
  "security",
  "robotics",
  "developer",
  "data",
  "cloud",
  "open source",
  "model",
  "agent",
  "computer",
];

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = initSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid persona request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const domain = parsed.data.persona.domain.toLowerCase();
  if (!TECH_TERMS.some((term) => domain.includes(term))) {
    return NextResponse.json(
      { error: "The persona domain must remain focused on AI or technology." },
      { status: 422 },
    );
  }

  const config = getConfig();
  const persona = compilePersona(parsed.data.persona);
  let agentId: string | null = null;
  try {
    agentId = await createAgent(
      parsed.data.persona,
      persona,
      config.EVALUATION_WINDOW_HOURS,
    );
    // Activate before starting to remove the workflow-start race: the first durable step
    // can never observe an INITIALIZING agent and exit prematurely.
    await prepareAgentForWorkflow(agentId);
    const run = await start(autonomousCreatorWorkflow, [
      { agentId, maxCycles: config.MAX_AUTONOMOUS_CYCLES },
    ]);
    await attachWorkflowRun(agentId, run.runId);
    return NextResponse.json(
      { agentId },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          Location: `/api/agent/feed?agentId=${encodeURIComponent(agentId)}`,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow start failed";
    if (agentId) await markAgentFailed(agentId, message).catch(() => undefined);
    return NextResponse.json(
      { error: "The autonomous agent could not be initialized safely." },
      { status: 503 },
    );
  }
}
