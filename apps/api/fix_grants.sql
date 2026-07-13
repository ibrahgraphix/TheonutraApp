-- ================================================================
-- Fix: Grant missing table privileges to service_role and anon
-- ================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Why this is needed:
--   When you apply schema.sql manually via the SQL editor, Postgres
--   creates the tables but Supabase's automatic "grant on all tables
--   to service_role" only runs for tables created through the
--   Supabase migration system. Tables created via raw SQL need their
--   grants applied manually.
-- ================================================================

-- Give service_role full access to every table (it already bypasses
-- RLS, but still needs the underlying Postgres GRANT to touch rows).
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Give anon SELECT on the tables whose RLS policies allow it
-- (needed so unauthenticated health checks / JWKS fetches don't break).
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Give authenticated users the access the RLS policies assume they have.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Make sure future tables created via the SQL editor also get the grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
