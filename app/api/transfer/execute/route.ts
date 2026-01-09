import { NextRequest, NextResponse } from "next/server";

import { getConnection } from "../../../lib/rpc";
import {
  deserializeRoutingPlan,
  executeRoutingPlan,
  SerializedRoutingPlan,
} from "../../../lib/uwuRouter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planData, fundedBurnerIndex } = body;

    if (!planData || typeof planData !== "object") {
      return NextResponse.json({ error: "Missing planData" }, { status: 400 });
    }

    const idx = typeof fundedBurnerIndex === "number" ? fundedBurnerIndex : 1;

    const connection = getConnection();
    const plan = deserializeRoutingPlan(planData as SerializedRoutingPlan);

    // Execute the routing plan
    const result = await executeRoutingPlan({
      connection,
      plan,
      fundedBurnerIndex: idx,
    });

    return NextResponse.json({
      id: result.id,
      success: result.success,
      totalTimeMs: result.totalTimeMs,
      finalSignature: result.finalSignature,
      hopResults: result.hopResults.map((hr) => ({
        index: hr.index,
        success: hr.success,
        signature: hr.signature,
        error: hr.error,
      })),
      error: result.error,
    });
  } catch (e) {
    console.error("Transfer execute error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
