-- Loot rarity weighting + three new base drops.
--
-- `weight` is the relative chance a base item is chosen when loot rolls (higher =
-- more common). Existing items default to 10. The runner re-applies every
-- migration, so this stays idempotent: the column guard is `if not exists` and
-- the inserts are `on conflict (name_key) do nothing`.
alter table items add column if not exists weight integer not null default 10;

-- New base (depth 0) drops:
--   Clover        common, from level 1 (high weight).
--   Light Energy  rare,   unlocks after level 10 (min_level 11, low weight).
--   Dark Energy   rare,   unlocks after level 10 (min_level 11, low weight).
-- power = sum of the four stats, matching the app's convention.
insert into items
  (name, name_key, base_key, glyph, bg_glyph, element, kind, stats, power, depth, min_level, tier, weight)
values
  ('Clover', 'clover', 'clover', '🍀', null, 'nature', 'misc',
   '{"health":2,"attack":0,"defense":1,"luck":5}'::jsonb, 8, 0, 1, 1, 22),
  ('Light Energy', 'light energy', 'light energy', '🌟', '☀️', 'light', 'element',
   '{"health":3,"attack":6,"defense":2,"luck":6}'::jsonb, 17, 0, 11, 3, 3),
  ('Dark Energy', 'dark energy', 'dark energy', '🌑', '🌌', 'dark', 'element',
   '{"health":4,"attack":8,"defense":4,"luck":2}'::jsonb, 18, 0, 11, 3, 3)
on conflict (name_key) do nothing;
