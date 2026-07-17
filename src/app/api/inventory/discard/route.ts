import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

// Discard an item the player no longer wants: removes the whole stack from the
// player's inventory. This only touches `player_inventory` (the player's copy) —
// the global `items` catalog, recipe cache, and crafting logic are untouched.
export async function POST(req: Request) {
  let playerId: unknown;
  let itemId: unknown;
  try {
    const body = await req.json();
    playerId = body?.playerId;
    itemId = body?.itemId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof playerId !== "string" || typeof itemId !== "string") {
    return NextResponse.json({ error: "Missing playerId or itemId." }, { status: 400 });
  }

  const sql = getSql();
  const deleted = await sql`
    delete from player_inventory
    where player_id = ${playerId} and item_id = ${itemId}
    returning item_id
  `;

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Item not in inventory." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
