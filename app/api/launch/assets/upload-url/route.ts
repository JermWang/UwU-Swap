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

function missingEnvVars(): string[] {
  const missing: string[] = [];
  const supabaseUrl = String(process.env.SUPABASE_URL ?? "").trim();
  const supabaseUrlPublic = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!supabaseUrl && !supabaseUrlPublic) missing.push("SUPABASE_URL");
  if (!serviceRole) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(req, { keyPrefix: "launch-assets:upload-url", limit: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      res.headers.set("retry-after", String(rl.retryAfterSeconds));
      return res;
    }

    const missing = missingEnvVars();
    if (missing.length) {
      return NextResponse.json(
        {
          error: "Server misconfigured for uploads",
          missingEnv: missing,
        },
        { status: 500 }
      );
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
      return NextResponse.json(
        {
          error: json?.message ?? json?.error ?? `Storage request failed (${res.status})`,
          storageStatus: res.status,
          storageBody: typeof json === "object" ? json : { message: String(json ?? "") },
        },
        { status: 500 }
      );
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
      bucket,
      path,
      token,
      signedUrl,
      publicUrl,
      expiresInSeconds,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: getSafeErrorMessage(e),
        missingEnv: missingEnvVars(),
      },
      { status: 500 }
    );
  }
}
