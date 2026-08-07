import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    await db()`SELECT 1 AS ok`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unavailable",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
