-- Synthetic privileged-clients state matching observed ACL shape.
-- All tables are empty and created in disposable PostgreSQL17 only.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.saved_searches(id uuid primary key, user_id uuid not null);
CREATE TABLE public.saved_search_matches(id uuid primary key, user_id uuid not null);
CREATE TABLE public.user_marketplace_preferences(user_id uuid primary key);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_search_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_marketplace_preferences ENABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE public.saved_searches,
  public.saved_search_matches, public.user_marketplace_preferences
  TO anon, authenticated;
