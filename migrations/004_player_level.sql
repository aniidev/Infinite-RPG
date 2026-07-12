-- Persist how far each player has progressed, so battles resume where they left
-- off instead of restarting at level 1.
alter table players add column if not exists level integer not null default 1;
