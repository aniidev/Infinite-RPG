-- Loot-tier balancing: every item carries a tier. Power is capped by
-- ceilingFor(tier); combining can raise power toward a tier ceiling but never
-- past it, and never raises tier. Tier only ever increases through loot.
-- Existing seed/base items stay tier 1 via the default; no backfill needed.
alter table items add column if not exists tier integer not null default 1;
