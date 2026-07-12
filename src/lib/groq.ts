import OpenAI from "openai";
import type { CraftGenResult, Item, Stats } from "@/game/types";

// Provider config. Groq is OpenAI-compatible, so we use the openai SDK pointed
// at Groq's base URL. To swap providers later (e.g. back to Anthropic, or
// OpenAI, or a local model), only this file changes — everyone else calls
// generateCraft(itemA, itemB).
const BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = "llama-3.3-70b-versatile";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set. Add it to .env.local.");
    }
    client = new OpenAI({ apiKey, baseURL: BASE_URL });
  }
  return client;
}

const SYSTEM_PROMPT = `You are the crafting engine for a fantasy RPG with infinite crafting.
Given two parent items, invent the SINGLE new item that results from combining them.

Respond with ONLY one valid JSON object and no other text, in exactly this shape:
{"name": string, "glyph": string, "element": string, "kind": string, "stats": {"health": number, "attack": number, "defense": number, "luck": number}}

Rules:
- "name": short (1-3 words), evocative, and family-friendly. Never offensive.
- "glyph": a single emoji that represents the item.
- "element": derive it sensibly from the parents (e.g. fire + ice -> "steam" or "water"; sword + fire -> "fire"). Lowercase. Use "none" if no element fits.
- "kind": exactly one of "weapon", "armor", "element", "misc".
- "stats": integers. The result should generally be STRONGER than its parents (roughly the sum of the parents' stats plus a small bonus), so deeper crafts trend more powerful. Keep every stat between 0 and 999.
Return only the JSON object.`;

function describeItem(item: Item): string {
  return `name="${item.name}", element="${item.element}", kind="${item.kind}", stats=${JSON.stringify(
    item.stats
  )}`;
}

function clampStat(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, n));
}

// Defensive parse: Llama sometimes returns extra prose or slightly-off shapes
// even in JSON mode, so we validate/coerce and return null on anything unusable
// (the caller retries once, then errors).
function parseCraft(raw: string): CraftGenResult | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;

  const record = obj as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) return null;

  const glyph =
    typeof record.glyph === "string" && record.glyph.trim()
      ? record.glyph.trim()
      : "✨";
  const element =
    typeof record.element === "string" && record.element.trim()
      ? record.element.trim().toLowerCase()
      : "none";
  const kind =
    typeof record.kind === "string" && record.kind.trim()
      ? record.kind.trim().toLowerCase()
      : "misc";

  const rawStats = (record.stats ?? {}) as Record<string, unknown>;
  const stats: Stats = {
    health: clampStat(rawStats.health),
    attack: clampStat(rawStats.attack),
    defense: clampStat(rawStats.defense),
    luck: clampStat(rawStats.luck),
  };

  return { name, glyph, element, kind, stats };
}

/**
 * Generate the result of combining two items. Provider-agnostic contract:
 * callers depend only on this function and its return type.
 */
export async function generateCraft(
  itemA: Item,
  itemB: Item
): Promise<CraftGenResult> {
  const userPrompt = `Combine these two items:\nA: ${describeItem(
    itemA
  )}\nB: ${describeItem(itemB)}`;

  // Try twice, since Llama is occasionally loose about format.
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      response_format: { type: "json_object" }, // JSON mode
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseCraft(raw);
    if (parsed) return parsed;
  }

  throw new Error("LLM returned malformed craft result after retry.");
}
