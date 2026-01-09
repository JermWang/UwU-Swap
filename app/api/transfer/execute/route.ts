import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await req.text().catch(() => "");
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use /api/transfer/status + /api/transfer/step (server-side persisted plans).",
    },
    { status: 410 }
  );
}
