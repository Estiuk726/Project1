-- ADR 0002: enable RLS with no policies on every public table, so the Supabase Data API
-- returns nothing. The app connects as the table owner and is not affected.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Keeps updated_at current on every UPDATE.
CREATE FUNCTION "public"."set_updated_at"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "user_profiles_set_updated_at" BEFORE UPDATE ON "user_profiles"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
