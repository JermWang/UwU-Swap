import { NextResponse } from "next/server";
import crypto from "crypto";
import { PublicKey } from "@solana/web3.js";

import { checkRateLimit } from "../../../../../lib/rateLimit";
import { getSafeErrorMessage } from "../../../../../lib/safeError";
import { getAdminSessionWallet, verifyAdminOrigin } from "../../../../../lib/adminSession";

export const runtime = "nodejs";

function requiredEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function requiredEnvAny(names: string[]): string {
  for (const n of names) {
    const v = String(process.env[n] ?? "").trim();
    if (v) return v;
  }
  throw new Error(`${names[0]} is required`);
}

function baseSupabaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function supabaseStorageBaseUrl(): string {
  const supabaseUrl = baseSupabaseUrl(requiredEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]));
  return `${supabaseUrl}/storage/v1`;
}

function absolutizeStorageUrl(rawUrl: string, input: { supabaseUrl: string; storageBase: string }): string {
  const raw = String(rawUrl ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const p = raw.replace(/^\/+/, "");
  if (p.startsWith("storage/v1/")) return `${input.supabaseUrl}/${p}`;
  return `${input.storageBase}/${p}`;
}

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return "jpg";
  if (ct.includes("image/gif")) return "gif";
  if (ct.includes("image/webp")) return "webp";
  return "png";
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(req, { keyPrefix: "admin:project-assets:upload-url", limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      res.headers.set("retry-after", String(rl.retryAfterSeconds));
      return res;
    }

    verifyAdminOrigin(req);

    const walletPubkey = await getAdminSessionWallet(req);
    if (!walletPubkey) return NextResponse.json({ error: "Admin sign-in required" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as any;

    const tokenMintRaw = typeof body?.tokenMint === "string" ? body.tokenMint.trim() : "";
    if (!tokenMintRaw) return NextResponse.json({ error: "tokenMint is required" }, { status: 400 });
    const tokenMint = new PublicKey(tokenMintRaw).toBase58();

    const kindRaw = typeof body?.kind === "string" ? body.kind.trim().toLowerCase() : "";
    const kind: "icon" | "banner" = kindRaw === "banner" ? "banner" : "icon";

    const contentType = typeof body?.contentType === "string" ? body.contentType.trim() : "image/png";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "contentType must be an image" }, { status: 400 });
    }

    const bucket = String(process.env.SUPABASE_PROJECT_ASSETS_BUCKET ?? "project-assets").trim() || "project-assets";
    const ext = extFromContentType(contentType);
    const id = crypto.randomBytes(12).toString("hex");
    const path = `${tokenMint}/${kind}/${id}.${ext}`;

    const supabaseUrl = baseSupabaseUrl(requiredEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]));
    const storageBase = supabaseStorageBaseUrl();
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const createUrl = `${storageBase}/object/upload/sign/${encodeURIComponent(bucket)}/${path}`;

    const expiresInSeconds = 2 * 60 * 60;

    const res = await fetch(createUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        "x-upsert": "true",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return NextResponse.json({ error: json?.message ?? json?.error ?? `Storage request failed (${res.status})` }, { status: 500 });
    }

    const signedUrl = absolutizeStorageUrl(String(json?.url ?? ""), { supabaseUrl, storageBase });
    const url = new URL(signedUrl);
    const token = url.searchParams.get("token") || "";
    if (!token) {
      return NextResponse.json({ error: "Storage did not return token" }, { status: 500 });
    }

    const publicUrl = `${storageBase}/object/public/${encodeURIComponent(bucket)}/${path}`;

    return NextResponse.json({
      ok: true,
      walletPubkey,
      bucket,
      path,
      token,
      signedUrl,
      publicUrl,
      expiresInSeconds,
    });
  } catch (e) {
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
