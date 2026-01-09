import { NextResponse } from "next/server";

import defaultProfile from "../../../docs/uwu_swap_assistant_profile.json";

export const runtime = "nodejs";

export async function GET() {
  try {
    let profile: any = defaultProfile as any;
    const inlineProfile = String(process.env.AGENT_PROFILE_JSON ?? "").trim();
    if (inlineProfile) {
      try {
        profile = JSON.parse(inlineProfile);
      } catch {
        // ignore invalid override
      }
    }

    return NextResponse.json(profile, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Failed to load agent profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
