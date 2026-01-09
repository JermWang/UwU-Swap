import { supabaseRestFetchJson } from "./supabaseRest";

export type UwuTransferStatus = "created" | "awaiting_funding" | "routing" | "complete" | "failed";

export type UwuTransferRecord<TData = any> = {
  id: string;
  status: UwuTransferStatus;
  version: number;
  data: TData;
  created_at?: string;
  updated_at?: string;
};

export async function createUwuTransfer<TData>(input: {
  id: string;
  status: UwuTransferStatus;
  data: TData;
}): Promise<UwuTransferRecord<TData>> {
  const rows = await supabaseRestFetchJson<UwuTransferRecord<TData>[]>({
    method: "POST",
    path: "/rest/v1/uwu_transfers",
    query: { select: "id,status,version,data,created_at,updated_at" },
    body: [{ id: input.id, status: input.status, data: input.data }],
    preferRepresentation: true,
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error("Failed to create transfer");
  return row;
}

export async function getUwuTransfer<TData>(id: string): Promise<UwuTransferRecord<TData> | null> {
  const rows = await supabaseRestFetchJson<UwuTransferRecord<TData>[]>({
    method: "GET",
    path: "/rest/v1/uwu_transfers",
    query: { id: `eq.${id}`, select: "id,status,version,data,created_at,updated_at", limit: "1" },
  });

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function tryUpdateUwuTransfer<TData>(input: {
  id: string;
  expectedVersion: number;
  status: UwuTransferStatus;
  data: TData;
}): Promise<UwuTransferRecord<TData> | null> {
  const nextVersion = Number(input.expectedVersion) + 1;

  const rows = await supabaseRestFetchJson<UwuTransferRecord<TData>[]>({
    method: "PATCH",
    path: "/rest/v1/uwu_transfers",
    query: {
      id: `eq.${input.id}`,
      version: `eq.${input.expectedVersion}`,
      select: "id,status,version,data,created_at,updated_at",
    },
    body: { status: input.status, version: nextVersion, data: input.data },
    preferRepresentation: true,
  });

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

export async function mutateUwuTransfer<TData>(input: {
  id: string;
  mutate: (current: UwuTransferRecord<TData>) => { status: UwuTransferStatus; data: TData };
  attempts?: number;
}): Promise<UwuTransferRecord<TData>> {
  const attempts = Math.max(1, Math.min(6, Number(input.attempts ?? 4) || 4));

  for (let i = 0; i < attempts; i++) {
    const current = await getUwuTransfer<TData>(input.id);
    if (!current) throw new Error("Transfer not found");

    const next = input.mutate(current);
    const updated = await tryUpdateUwuTransfer<TData>({
      id: input.id,
      expectedVersion: current.version,
      status: next.status,
      data: next.data,
    });

    if (updated) return updated;
  }

  throw new Error("Concurrent update conflict");
}
