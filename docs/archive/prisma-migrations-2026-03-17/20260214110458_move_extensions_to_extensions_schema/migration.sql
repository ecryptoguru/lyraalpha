-- Move extensions out of public schema (Supabase security advisor)
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
