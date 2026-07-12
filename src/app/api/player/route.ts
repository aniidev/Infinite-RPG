import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { grantStarterItem } from "@/lib/inventory";

export const runtime = "nodejs";

// Create an anonymous player (Milestone 1 has no auth). New players start with
// ONLY a Rusty Sword — everything else must be earned by battling.
export async function POST(req: Request) {
  const sql = getSql();

  let name: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.name === "string") {
      name = body.name.slice(0, 40);
    }
  } catch {
    // no body is fine
  }

  const [player] = await sql`
    insert into players (name) values (${name})
    returning id, name, level
  `;

  await grantStarterItem(sql, player.id);

  return NextResponse.json({ player });
}

// Fetch a player (used on load to resume their progress level).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  const sql = getSql();
  const [player] = await sql`select id, name, level from players where id = ${playerId}`;
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }
  return NextResponse.json({ player });
}
