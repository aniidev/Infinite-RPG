-- Milestone 1 schema for the infinite-crafting RPG.
-- The crafting mechanic + global recipe cache is the locked core; battle/loot
-- read from `items` but are otherwise independent, swappable modules.

create extension if not exists pgcrypto;

-- `kind` is a small, closed set that drives game logic -> modeled as an enum.
-- New kinds can be added later with: ALTER TYPE item_kind ADD VALUE '...';
do $$
begin
  if not exists (select 1 from pg_type where typname = 'item_kind') then
    create type item_kind as enum ('weapon', 'armor', 'element', 'misc');
  end if;
end$$;

-- `element` is intentionally open TEXT, not an enum. Infinite crafting means the
-- LLM can coin new elements (steam, storm, void, ...) at runtime; a hard enum
-- would reject them. The canonical known set (none, fire, ice) lives in TS.
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id                  uuid primary key default gen_random_uuid(),
  name                text        not null,
  glyph               text        not null,
  element             text        not null default 'none',
  kind                item_kind   not null default 'misc',
  stats               jsonb       not null default '{"health":0,"attack":0,"defense":0,"luck":0}',
  depth               integer     not null default 0,
  first_discovered_by uuid        references players(id),
  first_discovered_at timestamptz not null default now()
);

-- The global recipe cache. `key` is the normalized item pair (minId:maxId) so
-- order never matters. UNIQUE on the primary key gives us first-write-wins.
create table if not exists recipes (
  key            text primary key,
  input_a_id     uuid not null references items(id),
  input_b_id     uuid not null references items(id),
  output_item_id uuid not null references items(id),
  created_at     timestamptz not null default now()
);

create table if not exists player_inventory (
  player_id         uuid        not null references players(id) on delete cascade,
  item_id           uuid        not null references items(id),
  quantity          integer     not null default 1,
  first_obtained_at timestamptz not null default now(),
  primary key (player_id, item_id)
);

create index if not exists items_depth_idx on items (depth);
create index if not exists player_inventory_player_idx on player_inventory (player_id);
