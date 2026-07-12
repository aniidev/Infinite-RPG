import { NextResponse } from "next/server";
import { craft, CraftError } from "@/lib/craft";

export const runtime = "nodejs";

// The core endpoint. Input: { a, b, playerId } (two item ids + player id).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { a, b, playerId } = body ?? {};
    if (typeof a !== "string" || typeof b !== "string" || typeof playerId !== "string") {
      throw new CraftError("Request must include string a, b, and playerId.");
    }

    const result = await craft(playerId, a, b);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CraftError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[/api/craft]", err);
    return NextResponse.json({ error: "Crafting failed. Please try again." }, { status: 500 });
  }
}
