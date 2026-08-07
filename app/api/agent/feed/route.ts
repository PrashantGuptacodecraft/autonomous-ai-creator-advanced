import { NextResponse } from "next/server";
import { z } from "zod";
import { getFeed } from "@/lib/db/repository";

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

  const posts = await getFeed(parsed.data);
  if (posts === null) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json(
    { posts },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
