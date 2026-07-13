-- Minimum enemy level at which a base item can drop from battle. Lets loot be
-- gated so some items (e.g. Axe, Hammer) only appear in later levels.
alter table items add column if not exists min_level integer not null default 1;
