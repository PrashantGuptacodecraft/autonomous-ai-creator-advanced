import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboard } from "@/lib/db/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.string().trim().min(5).max(100);

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(url.searchParams.get("agentId"));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid agentId query parameter is required." }, { status: 400 });
  }
  const dashboard = await getDashboard(parsed.data);
  if (!dashboard) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  const latestRun = (dashboard.runs as Array<Record<string, unknown>>)[0] ?? null;
  return NextResponse.json({
    agentId: dashboard.agent.id,
    status: dashboard.agent.status,
    workflowRunId: dashboard.agent.workflow_run_id,
    initializedAt: new Date(dashboard.agent.initialized_at).toISOString(),
    evaluationEndsAt: new Date(dashboard.agent.evaluation_ends_at).toISOString(),
    lastCycleAt: dashboard.agent.last_cycle_at ? new Date(dashboard.agent.last_cycle_at).toISOString() : null,
    nextCycleAt: dashboard.agent.next_cycle_at ? new Date(dashboard.agent.next_cycle_at).toISOString() : null,
    completedCycles: Number(dashboard.agent.completed_cycles),
    publishedPosts: Number(dashboard.agent.published_count),
    latestRun,
    autonomyLedger: dashboard.ledger,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
