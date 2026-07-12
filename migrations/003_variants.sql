-- Monotonic variant naming: when the LLM proposes a name that already exists,
-- append an ordinal roman numeral (Fire Sword, Fire Sword II, Fire Sword III...).
-- Within a base name, a higher numeral must ALWAYS mean strictly higher power.
--
-- Supporting columns:
--   name_key : normalized full name (incl. numeral) — UNIQUE, enforces "one
--              item per variant name" and is the race-safety mechanism.
--   base_key : normalized base name with no numeral — groups variants so the
--              "strongest existing variant" lookup is a cheap indexed aggregate.
--   power    : cached total of the four stats.
--
-- `name_key` did not exist in 001, so it is added here as well. On a fresh DB
-- this runs after 002 (seed), so base items already exist and get backfilled.

alter table items add column if not exists name_key text;
alter table items add column if not exists base_key text;
alter table items add column if not exists power integer;

-- Backfill. Existing names carry no numeral (there was no variant system before),
-- so base_key = name_key here; new inserts strip any trailing numeral in the app
-- layer. This runs before the de-dup below, which renames duplicates but leaves
-- base_key untouched so variants stay grouped under their base name.
update items set
  name_key = lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
  base_key = lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
  power = coalesce((stats->>'attack')::int, 0)
        + coalesce((stats->>'defense')::int, 0)
        + coalesce((stats->>'health')::int, 0)
        + coalesce((stats->>'luck')::int, 0)
where name_key is null or base_key is null or power is null;

alter table items alter column name_key set not null;
alter table items alter column base_key set not null;
alter table items alter column power set not null;

-- Integer -> roman numeral (session-temporary; matches the app's roman()).
create or replace function pg_temp.to_roman(n int) returns text as $$
declare
  vals int[] := array[40, 10, 9, 5, 4, 1];
  syms text[] := array['XL', 'X', 'IX', 'V', 'IV', 'I'];
  i int;
  r text := '';
  x int := n;
begin
  if n <= 1 then return ''; end if;
  for i in 1 .. array_length(vals, 1) loop
    while x >= vals[i] loop
      r := r || syms[i];
      x := x - vals[i];
    end loop;
  end loop;
  return r;
end;
$$ language plpgsql;

-- Resolve any pre-existing duplicate names (crafted before this system) so the
-- unique index can be built. Items are referenced by id in recipes and
-- player_inventory, so renaming is safe. Within each base name we order by power
-- ascending and:
--   * assign monotonic numerals (weakest keeps the bare name),
--   * floor power to be strictly increasing by >= 15 WITHOUT ever decreasing an
--     item's power (running-max trick), then rescale stats to match.
-- For groups that are already unique and strictly increasing this is a no-op.
with r1 as (
  select
    id,
    base_key,
    (stats->>'health')::int  as h,
    (stats->>'attack')::int  as a,
    (stats->>'defense')::int as d,
    (stats->>'luck')::int    as l,
    power,
    row_number() over w  as rn,
    first_value(trim(name)) over w as base_name
  from items
  window w as (partition by base_key order by power asc, first_discovered_at asc, id asc)
),
r2 as (
  select
    *,
    -- new_power >= power AND strictly increasing by >= 15 across rn
    max(power - rn * 15) over (
      partition by base_key order by rn
      rows between unbounded preceding and current row
    ) + rn * 15 as new_power
  from r1
),
final as (
  select
    id,
    case when rn = 1 then base_name
         else base_name || ' ' || pg_temp.to_roman(rn::int) end as new_name,
    new_power,
    (h + a + d + l) as old_total,
    h, a, d, l
  from r2
)
update items i set
  name     = f.new_name,
  name_key = lower(regexp_replace(f.new_name, '\s+', ' ', 'g')),
  power    = f.new_power,
  stats    = case
    when f.old_total <= 0 then
      jsonb_build_object('health', 0, 'attack', f.new_power, 'defense', 0, 'luck', 0)
    else
      jsonb_build_object(
        'health',  round(f.h::numeric * f.new_power / f.old_total)::int,
        'attack',  round(f.a::numeric * f.new_power / f.old_total)::int,
        'defense', round(f.d::numeric * f.new_power / f.old_total)::int,
        'luck',    round(f.l::numeric * f.new_power / f.old_total)::int
      )
  end
from final f
where i.id = f.id;

-- One item per variant name. This UNIQUE index is what makes concurrent inserts
-- safe: only one racer can claim a given name_key; the loser retries the numeral.
create unique index if not exists items_name_key_uidx on items (name_key);
create index if not exists items_base_key_idx on items (base_key);
