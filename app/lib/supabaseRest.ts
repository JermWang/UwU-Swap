type SupabaseRestMethod = "GET" | "POST" | "PATCH";

function mustGetSupabaseUrl(): string {
  const url = String(process.env.SUPABASE_URL ?? "").trim();
  if (!url) throw new Error("Missing SUPABASE_URL");
  return url.replace(/\/+$/, "");
}

function mustGetSupabaseServiceRoleKey(): string {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return key;
}

export async function supabaseRestFetchJson<T>(input: {
  method: SupabaseRestMethod;
  path: string;
  query?: Record<string, string>;
  body?: any;
  preferRepresentation?: boolean;
}): Promise<T> {
  const baseUrl = mustGetSupabaseUrl();
  const key = mustGetSupabaseServiceRoleKey();

  const qs = input.query ? new URLSearchParams(input.query).toString() : "";
  const url = `${baseUrl}${input.path}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: input.method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(input.preferRepresentation ? { Prefer: "return=representation" } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase REST error (${res.status}): ${text || res.statusText}`);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
