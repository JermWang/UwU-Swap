import { NextResponse } from "next/server";
import crypto from "crypto";

import { checkRateLimit } from "../../../../lib/rateLimit";
import { getSafeErrorMessage } from "../../../../lib/safeError";

export const runtime = "nodejs";

function requiredEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function baseSupabaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function supabaseStorageBaseUrl(): string {
  const supabaseUrl = baseSupabaseUrl(requiredEnv("SUPABASE_URL"));
  return `${supabaseUrl}/storage/v1`;
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
    const rl = await checkRateLimit(req, { keyPrefix: "launch-assets:upload-url", limit: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      res.headers.set("retry-after", String(rl.retryAfterSeconds));
      return res;
    }

    const body = (await req.json().catch(() => null)) as any;

    const kindRaw = typeof body?.kind === "string" ? body.kind.trim().toLowerCase() : "";
    const kind: "icon" | "banner" = kindRaw === "banner" ? "banner" : "icon";

    const contentType = typeof body?.contentType === "string" ? body.contentType.trim() : "image/png";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "contentType must be an image" }, { status: 400 });
    }

    const bucket = String(process.env.SUPABASE_PROJECT_ASSETS_BUCKET ?? "project-assets").trim() || "project-assets";
    const ext = extFromContentType(contentType);
    const sessionId = crypto.randomBytes(16).toString("hex");
    const fileId = crypto.randomBytes(12).toString("hex");
    const path = `launch-staging/${sessionId}/${kind}/${fileId}.${ext}`;

    const storageBase = supabaseStorageBaseUrl();
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const createUrl = `${storageBase}/object/upload/sign/${encodeURIComponent(bucket)}/${path}`;

    const res = await fetch(createUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        "x-upsert": "true",
      },
      body: JSON.stringify({}),
    });

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return NextResponse.json({ error: json?.message ?? json?.error ?? `Storage request failed (${res.status})` }, { status: 500 });
    }

    const url = new URL(String(json?.url ?? ""), storageBase);
    const token = url.searchParams.get("token") || "";
    if (!token) {
      return NextResponse.json({ error: "Storage did not return token" }, { status: 500 });
    }

    const signedUrl = url.toString();
    const publicUrl = `${storageBase}/object/public/${encodeURIComponent(bucket)}/${path}`;

    return NextResponse.json({
      ok: true,
      bucket,
      path,
      token,
      signedUrl,
      publicUrl,
      expiresInSeconds: 2 * 60 * 60,
    });
  } catch (e) {
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
