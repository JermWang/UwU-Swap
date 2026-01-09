import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import defaultProfile from "../../../docs/uwu_swap_assistant_profile.json";
import { UWU_KNOWLEDGE_BASE_TEXT } from "../../lib/uwuKnowledgeBase";

export const runtime = "nodejs";

type InboundMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatAction =
  | {
      type: "transfer";
      asset: "SOL";
      amountSol: number;
      destination: string;
    }
  | { type: "none" };

type ChatResponse = {
  reply: string;
  action: ChatAction | null;
};

function normalizeDestination(raw: string): string {
  const s = String(raw ?? "").trim();
  return s.replace(/[\s\]\)\}\.,;:!\?]+$/g, "");
}

function heuristicTransferActionFromText(text: string): ChatAction | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const hasSendKeyword = ["send", "transfer", "pay", "move"].some((k) => lower.includes(k));
  if (!hasSendKeyword) return null;

  const amountMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:sol|SOL|◎)/i);
  const destMatch = raw.match(/([1-9A-HJ-NP-Za-km-z]{32,44}|[a-z0-9-]{1,63}\.sol)/i);
  if (!amountMatch || !destMatch) return null;

  const amountSol = Number(amountMatch[1]);
  const destination = normalizeDestination(destMatch[1] ?? "");
  if (!Number.isFinite(amountSol) || amountSol <= 0) return null;

  // Allow .sol domains to be resolved client-side.
  if (!destination.toLowerCase().endsWith(".sol")) {
    try {
      new PublicKey(destination);
    } catch {
      return null;
    }
  }

  return { type: "transfer", asset: "SOL", amountSol, destination };
}

function normalizeInboundMessages(input: any): InboundMessage[] {
  const arr = Array.isArray(input) ? input : [];
  const out: InboundMessage[] = [];

  for (const m of arr) {
    const role = String(m?.role ?? "").trim();
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    const content = String(m?.content ?? "").trim();
    if (!content) continue;
    out.push({ role, content });
  }

  // Keep context bounded.
  return out.slice(-24);
}

function validateTransferAction(action: any): ChatAction | null {
  if (!action || typeof action !== "object") return null;
  const type = String(action.type ?? "").trim();
  if (type === "none") return { type: "none" };
  if (type !== "transfer") return null;

  const asset = String(action.asset ?? "").trim();
  if (asset !== "SOL") return null;

  const amountSol = Number(action.amountSol);
  if (!Number.isFinite(amountSol) || amountSol <= 0) return null;

  const destination = normalizeDestination(action.destination ?? "");
  if (!destination) return null;

  // Accept either a base58 pubkey OR a .sol domain (resolved in client before creating a plan).
  if (!destination.toLowerCase().endsWith(".sol")) {
    try {
      new PublicKey(destination);
    } catch {
      return null;
    }
  }

  return { type: "transfer", asset: "SOL", amountSol, destination };
}

async function callOpenAiChat(input: {
  system: string;
  messages: InboundMessage[];
}): Promise<ChatResponse> {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const heuristic = heuristicTransferActionFromText(lastUser?.content ?? "");

  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    const action = heuristic;
    return {
      reply: action
        ? "I can help with that transfer, but the AI chat backend isn't configured yet. Please set `OPENAI_API_KEY` to enable full conversational answers."
        : "AI is not configured on the server yet. Please set `OPENAI_API_KEY` and redeploy.",
      action,
    };
  }

  const model = String(process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: input.system }, ...input.messages],
    }),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const msg =
      typeof json?.error?.message === "string"
        ? json.error.message
        : `OpenAI request failed (${res.status})`;
    return { reply: msg, action: heuristic };
  }

  const content = String(json?.choices?.[0]?.message?.content ?? "").trim();
  if (!content) return { reply: "Sorry—no response.", action: null };

  try {
    const parsed = JSON.parse(content);
    const reply = String(parsed?.reply ?? "").trim();
    const validated = validateTransferAction(parsed?.action) ?? null;
    const action = validated && validated.type === "none" ? null : validated;
    return { reply: reply || content, action: action ?? heuristic };
  } catch {
    return { reply: content, action: heuristic };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const inbound = normalizeInboundMessages(body?.messages);

    if (!inbound.length) {
      return NextResponse.json({ reply: "Ask me anything about Uwu Swap—privacy, fees, or how transfers work.", action: null });
    }

    let profile: any = defaultProfile as any;
    const inlineProfile = String(process.env.AGENT_PROFILE_JSON ?? "").trim();
    if (inlineProfile) {
      try {
        profile = JSON.parse(inlineProfile);
      } catch {
        // ignore invalid override
      }
    }
    const docsText = String(UWU_KNOWLEDGE_BASE_TEXT ?? "");

    const assistantName = String(profile?.name ?? "Nana~");
    const assistantRole = String(profile?.role ?? "Uwu Swap Privacy Assistant");

    const personality = profile?.personality ? JSON.stringify(profile.personality) : "{}";
    const samplePhrases = profile?.sample_phrases ? JSON.stringify(profile.sample_phrases) : "{}";

    const system = [
      `You are ${assistantName}, ${assistantRole}.`,
      "You are a conversational assistant for the Uwu Swap website.",
      "Primary goal: help users by answering questions about the product, brand, and documentation.",
      "Secondary goal: when (and only when) the user clearly asks to send a private transfer, propose an action.",
      "Be natural and helpful. Keep answers grounded in the provided knowledge base.",
      "If asked for info not present, say you are not sure and suggest where to look.",
      "Do not claim to have processed volume, audits, or compliance features unless it is explicitly in the provided knowledge base; if it is in the knowledge base, present it as "
        + "what the docs say (not as a guaranteed fact).",
      "Current product reality note: connected-wallet private transfers exist; Quick Send may be disabled until it is ready.",
      "Never request or expose private keys, secrets, or API keys.",
      "Output must be STRICT JSON with shape: { reply: string, action: {type: 'transfer', asset:'SOL', amountSol:number, destination:string} | {type:'none'} | null }.",
      "For transfer actions, destination can be either a Solana base58 address OR a .sol domain.",
      "Only include an action when the user intent is explicit (e.g. 'send 0.5 SOL to ...').",
      "If the user is asking questions, action must be null.",
      `Personality JSON: ${personality}`,
      `Sample phrases JSON: ${samplePhrases}`,
      "Knowledge base (docs + readme excerpt):",
      docsText ? docsText : "(no docs available)",
    ].join("\n\n");

    const result = await callOpenAiChat({ system, messages: inbound });

    // Normalize empty replies.
    const reply = String(result.reply ?? "").trim() || "(no response)";
    const action = result.action;

    return NextResponse.json({ reply, action } satisfies ChatResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ reply: msg, action: null }, { status: 500 });
  }
}
