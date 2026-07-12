import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

// Create an anonymous player (Milestone 1 has no auth). New players are granted
// one of each base item so they can start crafting immediately.
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
    returning id, name, created_at
  `;

  const bases = await sql`select id from items where depth = 0`;
  for (const base of bases) {
    await sql`
      insert into player_inventory (player_id, item_id, quantity)
      values (${player.id}, ${base.id}, 1)
      on conflict (player_id, item_id) do nothing
    `;
  }

  return NextResponse.json({ player });
}
