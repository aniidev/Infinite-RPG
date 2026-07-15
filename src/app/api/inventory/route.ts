import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  const sql = getSql();
  const items = await sql`
    select i.id, i.name, i.glyph, i.bg_glyph as "bgGlyph", i.element, i.kind, i.stats, i.depth, i.tier, pi.quantity
    from player_inventory pi
    join items i on i.id = pi.item_id
    where pi.player_id = ${playerId}
    order by pi.first_obtained_at desc
  `;

  return NextResponse.json({ items });
}
