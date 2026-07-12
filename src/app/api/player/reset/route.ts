import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { grantStarterItem } from "@/lib/inventory";

export const runtime = "nodejs";

// Restart a game: wipe the player's inventory, reset their level to 1, and grant
// only the Rusty Sword back. The player id is kept.
export async function POST(req: Request) {
  let playerId: unknown;
  try {
    const body = await req.json();
    playerId = body?.playerId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof playerId !== "string") {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  const sql = getSql();
  const [exists] = await sql`select id from players where id = ${playerId}`;
  if (!exists) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  await sql`delete from player_inventory where player_id = ${playerId}`;
  await sql`update players set level = 1 where id = ${playerId}`;
  await grantStarterItem(sql, playerId);

  const [player] = await sql`select id, name, level from players where id = ${playerId}`;
  return NextResponse.json({ player });
}
