import { NextResponse } from "next/server";

import { getAdminSessionWallet } from "../../../lib/adminSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const walletPubkey = await getAdminSessionWallet(req);
    return NextResponse.json({ walletPubkey });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
