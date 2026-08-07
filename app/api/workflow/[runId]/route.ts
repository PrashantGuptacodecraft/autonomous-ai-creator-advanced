import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await context.params;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return NextResponse.json({ error: "Operational endpoint is disabled." }, { status: 404 });
  }
  if (request.headers.get("x-admin-key") !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const agents = (await db()`
    SELECT id, name, domain, status, workflow_run_id, initialized_at,
           evaluation_ends_at, last_cycle_at, next_cycle_at, completed_cycles,
           published_count, failure_reason
    FROM agents WHERE workflow_run_id = ${runId}
  `) as unknown as Array<Record<string, unknown>>;
  const agent = agents[0];
  if (!agent) return NextResponse.json({ error: "Workflow run not found." }, { status: 404 });
  const cycles = await db()`
    SELECT id, cycle_number, status, started_at, completed_at,
           discovered_count, rejected_count, held_count, published_post_id,
           reason, error
    FROM agent_runs
    WHERE agent_id = ${String(agent.id)}
    ORDER BY cycle_number DESC
  `;
  return NextResponse.json({ agent, cycles }, { headers: { "Cache-Control": "no-store" } });
}
