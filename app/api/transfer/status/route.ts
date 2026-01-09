import { NextRequest, NextResponse } from "next/server";

import { getUwuTransfer } from "../../../lib/uwuTransferStore";
import { getSafeErrorMessage } from "../../../lib/safeError";
import type { UwuPrivyTransferData } from "../../../lib/uwuPrivyRouter";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const rec = await getUwuTransfer<UwuPrivyTransferData>(id);
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = rec.data;

    return NextResponse.json({
      id: rec.id,
      status: rec.status,
      version: rec.version,
      plan: {
        id: data?.plan?.id,
        fromWallet: data?.plan?.fromWallet,
        toWallet: data?.plan?.toWallet,
        asset: data?.plan?.asset,
        amountLamports: data?.plan?.amountLamports,
        netAmountLamports: data?.plan?.netAmountLamports,
        hopCount: data?.plan?.hopCount,
        estimatedCompletionMs: data?.plan?.estimatedCompletionMs,
        feeApplied: data?.plan?.feeApplied,
        feeLamports: data?.plan?.feeLamports,
        firstBurnerPubkey: data?.plan?.burners?.[0]?.address,
      },
      state: {
        funded: data?.state?.funded ?? false,
        fundingSignature: data?.state?.fundingSignature,
        fundingSignatureSetAtUnixMs: data?.state?.fundingSignatureSetAtUnixMs,
        feeCollected: data?.state?.feeCollected ?? false,
        currentHop: data?.state?.currentHop ?? 0,
        hopResults: Array.isArray(data?.state?.hopResults) ? data.state.hopResults : [],
        finalSignature: data?.state?.finalSignature,
        nextActionAtUnixMs: data?.state?.nextActionAtUnixMs ?? Date.now(),
        lastError: data?.state?.lastError,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
