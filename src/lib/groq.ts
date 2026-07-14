import OpenAI from "openai";
import type { CraftGenResult, Item } from "@/game/types";

// Provider config. Groq is OpenAI-compatible, so we use the openai SDK pointed
// at Groq's base URL. To swap providers later, only this file changes — everyone
// else calls generateCraft(itemA, itemB).
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

// The LLM decides IDENTITY and FLAVOR only — never power, stats, or even the
// stat distribution. Stats are derived from the parents' combined profile, so a
// combine can never be weaker than both parents.
const SYSTEM_PROMPT = `You are the crafting engine for a fantasy RPG with infinite crafting.
Given two parent items, invent the SINGLE new item that results from combining them.

Respond with ONLY one valid JSON object and no other text, in exactly this shape:
{"name": string, "glyph": string, "background": string, "element": string, "kind": string}

Rules:
- "name": short (1-3 words), evocative, and family-friendly. Never offensive.
- "glyph": a SINGLE emoji for the item itself (shown in front) — e.g. a sword ⚔️.
- "background": a SINGLE different emoji shown large and faded BEHIND the item to convey its element or vibe — e.g. 🔥 behind a fire sword, ❄️ behind an ice blade, 🌊 behind a water staff. Pick the most fitting emoji; it should differ from "glyph". Use "" only if truly nothing fits.
- "element": derive it sensibly from the parents (e.g. fire + ice -> "steam" or "water"). Lowercase. Use "none" if no element fits.
- "kind": exactly one of "weapon", "armor", "element", "misc".
Do NOT output stats or power — only the identity above.
Return only the JSON object.`;

function describeItem(item: Item): string {
  // Identity only — deliberately omit stats/power so the model doesn't anchor
  // on the parents' numbers (stats are computed locally, not by the LLM).
  return `name="${item.name}", element="${item.element}", kind="${item.kind}"`;
}

// Accept only a short, letter-free string (an emoji / emoji sequence), else "".
// Keeps stray words like "fire" out of the glyph fields.
function cleanEmoji(value: unknown): string {
  if (typeof value !== "string") return "";
  const t = value.trim();
  if (!t || t.length > 16 || /[a-zA-Z0-9]/.test(t)) return "";
  return t;
}

// Defensive parse: Llama occasionally returns extra prose even in JSON mode, so
// we validate/coerce and return null on anything unusable (the caller retries
// once, then errors).
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

  const glyph = cleanEmoji(record.glyph) || "✨";
  // Background is optional; drop it if it's missing, invalid, or identical to
  // the foreground (nothing to layer).
  let bgGlyph = cleanEmoji(record.background);
  if (bgGlyph === glyph) bgGlyph = "";

  const element =
    typeof record.element === "string" && record.element.trim()
      ? record.element.trim().toLowerCase()
      : "none";
  const kind =
    typeof record.kind === "string" && record.kind.trim()
      ? record.kind.trim().toLowerCase()
      : "misc";

  return { name, glyph, bgGlyph, element, kind };
}

/**
 * Generate the IDENTITY of combining two items. Provider-agnostic contract:
 * callers depend only on this function and its return type. Power AND stat
 * distribution are computed locally — never by the LLM.
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
