-- Second, LLM-authored emoji for layered item art: the big background/aura emoji
-- shown behind the item's main glyph. Nullable — items without one fall back to
-- an element-derived aura in the UI.
alter table items add column if not exists bg_glyph text;
