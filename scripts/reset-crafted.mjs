// Wipe all crafted data — recipes, crafted items (depth > 0), and any inventory
// rows pointing at them — leaving only the base (depth 0) seed items. This
// clears the polluted/over-powered crafts so future crafting regenerates with
// the corrected (non-inflating) stat logic.
//
// Run with: npm run db:reset-crafted
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

try {
  await sql.begin(async (tx) => {
    // recipes reference items; delete them all first (base items remain).
    const recipes = await tx`delete from recipes`;
    // inventory rows for crafted items must go before the items themselves.
    const inv = await tx`
      delete from player_inventory
      where item_id in (select id from items where depth > 0)
    `;
    const items = await tx`delete from items where depth > 0`;
    console.log(
      `Deleted ${recipes.count} recipes, ${inv.count} crafted inventory rows, ${items.count} crafted items.`
    );
  });

  const remaining = await sql`select name, depth, power from items order by depth, name`;
  console.log(`\nRemaining items (${remaining.length}):`);
  for (const r of remaining) {
    console.log(`  depth ${r.depth}  power ${r.power}  ${r.name}`);
  }
} catch (err) {
  console.error("Reset failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
