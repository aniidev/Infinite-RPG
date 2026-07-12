import type { PostgresClient } from "./db";

// Small shared helper: grant a player one of an item (or increment its count).
export async function addToInventory(
  sql: PostgresClient,
  playerId: string,
  itemId: string
): Promise<void> {
  await sql`
    insert into player_inventory (player_id, item_id, quantity)
    values (${playerId}, ${itemId}, 1)
    on conflict (player_id, item_id)
    do update set quantity = player_inventory.quantity + 1
  `;
}
