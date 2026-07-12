-- Seed the base (depth 0) items. Idempotent: only inserts when no base items
-- exist yet, so re-running migrations never duplicates the seed set.
insert into items (name, glyph, element, kind, stats, depth)
select v.name, v.glyph, v.element, v.kind::item_kind, v.stats::jsonb, 0
from (values
  ('Rusty Sword',   '🗡️', 'none', 'weapon',  '{"health":0,"attack":6,"defense":1,"luck":0}'),
  ('Wooden Shield', '🛡️', 'none', 'armor',   '{"health":8,"attack":0,"defense":6,"luck":0}'),
  ('Fire Shard',    '🔥', 'fire', 'element', '{"health":0,"attack":4,"defense":0,"luck":2}'),
  ('Ice Shard',     '❄️', 'ice',  'element', '{"health":2,"attack":3,"defense":2,"luck":1}')
) as v(name, glyph, element, kind, stats)
where not exists (select 1 from items where depth = 0);
