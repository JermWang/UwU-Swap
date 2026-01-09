import { NextResponse } from "next/server";

import { getConnection } from "../../lib/rpc";

export const runtime = "nodejs";

type HealthStatus = "ok" | "degraded" | "error";

type HealthCheck = {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
};

export async function GET() {
  const checks: HealthCheck[] = [];
  const startTime = Date.now();

  // Check Solana RPC connectivity
  const solanaCheck = await checkSolanaRpc();
  checks.push(solanaCheck);

  // Determine overall status
  const hasError = checks.some((c) => c.status === "error");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  const overallStatus: HealthStatus = hasError ? "error" : hasDegraded ? "degraded" : "ok";

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    totalLatencyMs: Date.now() - startTime,
  };

  const httpStatus = overallStatus === "ok" ? 200 : overallStatus === "degraded" ? 200 : 503;
  return NextResponse.json(response, { status: httpStatus });
}

async function checkSolanaRpc(): Promise<HealthCheck> {
  const start = Date.now();

  try {
    const connection = getConnection();
    const slot = await connection.getSlot("confirmed");

    if (!Number.isFinite(slot) || slot <= 0) {
      return {
        name: "solana_rpc",
        status: "error",
        latencyMs: Date.now() - start,
        error: "Invalid slot returned",
      };
    }

    const latencyMs = Date.now() - start;
    const status: HealthStatus = latencyMs > 2000 ? "degraded" : "ok";

    return {
      name: "solana_rpc",
      status,
      latencyMs,
      error: status === "degraded" ? "High latency" : undefined,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      name: "solana_rpc",
      status: "error",
      latencyMs: Date.now() - start,
      error,
    };
  }
}
