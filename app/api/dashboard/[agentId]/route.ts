import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/db/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ agentId: string }> },
): Promise<NextResponse> {
  const { agentId } = await context.params;
  const dashboard = await getDashboard(agentId);
  if (!dashboard) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json(dashboard, {
    headers: { "Cache-Control": "no-store" },
  });
}
