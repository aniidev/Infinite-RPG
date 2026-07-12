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

// The single starting item. New players (and a restarted game) get only this —
// everything else must be earned by battling and crafting.
export async function grantStarterItem(
  sql: PostgresClient,
  playerId: string
): Promise<void> {
  const [rusty] = await sql`
    select id from items where depth = 0 and lower(name) = 'rusty sword' limit 1
  `;
  if (rusty) {
    await sql`
      insert into player_inventory (player_id, item_id, quantity)
      values (${playerId}, ${rusty.id}, 1)
      on conflict (player_id, item_id) do nothing
    `;
  }
}
