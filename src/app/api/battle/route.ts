import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { addToInventory } from "@/lib/inventory";
import { rollLoot } from "@/game/loot/table";
import type { InventoryItem } from "@/game/types";

export const runtime = "nodejs";

// Called when the player defeats an enemy. Rolls loot from a table that scales
// with enemy level, adds it to the player's inventory, and returns the drops
// (aggregated by item so the client can show "x2" etc).
export async function POST(req: Request) {
  let playerId: unknown;
  let level: unknown;
  try {
    const body = await req.json();
    playerId = body?.playerId;
    level = body?.level;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof playerId !== "string") {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  const enemyLevel = Math.max(1, Math.min(99, Math.floor(Number(level) || 1)));
  const sql = getSql();

  const drops = await rollLoot(sql, enemyLevel);
  for (const item of drops) {
    await addToInventory(sql, playerId, item.id);
  }

  // Aggregate duplicate drops into { ...item, quantity }.
  const byId = new Map<string, InventoryItem>();
  for (const item of drops) {
    const existing = byId.get(item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      byId.set(item.id, { ...item, quantity: 1 });
    }
  }

  return NextResponse.json({ loot: Array.from(byId.values()) });
}
