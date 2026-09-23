-- Persist category-specific listing details instead of embedding them in description.

alter table public.listings
  add column if not exists subject text,
  add column if not exists specific_type text,
  add column if not exists size_label text,
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists season text;

update public.listings
set
  subject = coalesce(subject, nullif(substring(description from '(?m)^- Asignatura: (.+)$'), '')),
  specific_type = coalesce(specific_type, nullif(substring(description from '(?m)^- Tipo: (.+)$'), '')),
  size_label = coalesce(size_label, nullif(substring(description from '(?m)^- Talla: (.+)$'), '')),
  season = coalesce(season, nullif(substring(description from '(?m)^- Temporada: (.+)$'), '')),
  brand = coalesce(brand, nullif(substring(description from '(?m)^- Marca: (.+)$'), '')),
  model = coalesce(model, nullif(substring(description from '(?m)^- Modelo: (.+)$'), '')),
  description = btrim(split_part(description, E'\n\nDetalles del material:\n', 1))
where description like '%' || E'\n\nDetalles del material:\n' || '%';
