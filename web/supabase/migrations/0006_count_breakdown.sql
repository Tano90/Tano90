-- S17: counting in packages. The counted total stays in counted_base; breakdown keeps what was
-- typed ({"packs": {"<package id>": 3}, "looseBase": 250}) so the sheet shows it again after a reload.
alter table stock_count_lines add column breakdown jsonb
  check (breakdown is null or (jsonb_typeof(breakdown) = 'object' and jsonb_typeof(breakdown->'packs') = 'object'));
