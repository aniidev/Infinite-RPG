# Infinite Crafting RPG — Milestone 1

A browser RPG where you fight enemies for loot and **combine any two items to craft new ones**. New combinations are resolved by an LLM; the first player to discover a combination writes the result to a **global recipe cache**, and every later player reads from that cache instead of calling the LLM again.

This repo is the Milestone 1 vertical slice: fight → loot → craft, with the global cache working correctly.

## Stack

- **Next.js (App Router) + TypeScript (strict)** — one repo for UI and API routes
- **React + dnd-kit** — drag one item card onto another to craft
- **Postgres (Supabase)** via the **pooled Supavisor / PgBouncer** connection (`prepare: false`)
- **Groq** for craft resolution — OpenAI-compatible API (`openai` SDK pointed at Groq), model `llama-3.3-70b-versatile`, JSON mode
- **Tailwind CSS**

## Architecture

The **crafting mechanic + global cache is the locked core**. Battle and loot are intentionally flexible, swappable modules.

```
src/
  lib/
    db.ts           # pooled Postgres client (Supavisor, prepare:false)
    groq.ts         # generateCraft(itemA, itemB) — the ONLY provider-specific file
    moderation.ts   # blocklist run before anything enters the global cache
    lock.ts         # in-memory single-flight lock (seam for Redis / advisory lock)
    inventory.ts    # addToInventory helper
    craft.ts        # THE CORE: normalize -> cache check -> lock -> generate -> moderate -> insert
  game/
    types.ts
    battle/engine.ts # swappable placeholder battle logic (pure functions)
    loot/table.ts    # swappable loot table (scales with enemy level)
  app/
    api/{craft,battle,inventory,player}/route.ts
    components/{GameClient,ItemCard,BattleScreen}.tsx
migrations/          # 001 schema, 002 seed (Rusty Sword, Wooden Shield, Fire/Ice Shard)
scripts/migrate.mjs  # runs migrations in order
```

### `/api/craft` (the core endpoint)

Input: `{ a, b, playerId }` (two item ids + player id).

1. **Normalize** the pair — sort the ids into `minId:maxId` so order never matters.
2. **Cache check** — on a hit, add the existing output to the player's inventory and return it. No LLM call.
3. **On a miss** — acquire an in-memory single-flight lock on the recipe key, re-check the cache, call `generateCraft`, **moderate** the name (regenerate once, else reject — nothing offensive can enter the shared cache), insert the item, then upsert the recipe with `ON CONFLICT (key) DO NOTHING`. If a concurrent request already inserted it, adopt the winner's item and discard the orphan. **First write wins**; discovery attribution goes to the winner.

### Swapping the LLM provider

Everything goes through `generateCraft(itemA, itemB)` in `src/lib/groq.ts`. To swap providers, change only that file — the crafting logic never touches provider details.

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment** — copy `.env.example` to `.env.local` and fill in:

   | Variable       | What                                                                                                   |
   | -------------- | ------------------------------------------------------------------------------------------------------ |
   | `DATABASE_URL` | Supabase **pooled** (Transaction / Supavisor) connection string — host `...pooler.supabase.com:6543`. Do **not** use the direct connection. |
   | `GROQ_API_KEY` | Groq API key from <https://console.groq.com/keys>                                                       |

   ```bash
   cp .env.example .env.local
   ```

3. **Migrate + seed the database**

   ```bash
   npm run db:migrate
   ```

   Creates the schema and seeds the base items (Rusty Sword, Wooden Shield, Fire Shard, Ice Shard).

4. **Run**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>. A local anonymous player id is created and stored in `localStorage`; new players start with one of each base item.

## Deploying to Vercel

Add `DATABASE_URL` (pooled connection string) and `GROQ_API_KEY` as environment variables. Run `npm run db:migrate` once against your database.

## Data model

- **items**: `id, name, glyph, element (text, open), kind (enum: weapon/armor/element/misc), stats (jsonb: health/attack/defense/luck), depth, first_discovered_by, first_discovered_at`
- **recipes**: `key (pk, minId:maxId), input_a_id, input_b_id, output_item_id, created_at`
- **player_inventory**: `player_id, item_id, quantity, first_obtained_at` (pk = player_id + item_id)
- **players**: `id, name, created_at`

> Note: `element` is open TEXT (not a DB enum) so infinite crafting can coin new elements at runtime; `kind` is a closed enum. See `migrations/001_init.sql`.

## Deliberately out of scope (Milestone 1)

Redis hot cache, read replicas, real auth, a real-time "first discovered" feed, sound, and advanced battle mechanics / balancing. These are left as clean seams (see comments in `lock.ts`, `groq.ts`, `battle/engine.ts`, `loot/table.ts`).
