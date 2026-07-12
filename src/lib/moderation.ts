// Moderation for generated item names. Whatever passes here can be written to
// the GLOBAL recipe cache and shown to every future player, so this must run
// before any write.
//
// SEAM: this is a deliberately simple blocklist for Milestone 1. For production,
// keep the blocklist AND add a real moderation model / service (e.g. an LLM
// moderation endpoint) in front of it. Return shape stays the same.
const BLOCKLIST: string[] = [
  // profanity
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "bastard",
  // slurs / hate — the whole point of moderating a shared cache
  "nigger",
  "faggot",
  "retard",
  // extend this list; prefer a maintained dataset in production
];

const BLOCK_PATTERNS = BLOCKLIST.map(
  (w) => new RegExp(`\\b${w}\\b`, "i")
);

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

export function moderateName(name: string): ModerationResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "empty name" };
  if (trimmed.length > 40) return { ok: false, reason: "name too long" };

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, reason: "blocked term" };
    }
  }
  return { ok: true };
}
