// Supabase SQL schema — run this in the Supabase SQL Editor to create all tables
// Tables are prefixed with "scriptlyst_" to share the Supabase project with other apps

const SCHEMA_SQL = `
-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS scriptlyst_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  niche TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_scriptlyst_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.scriptlyst_profiles (id, email, plan, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'free', now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_scriptlyst ON auth.users;
CREATE TRIGGER on_auth_user_created_scriptlyst
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_scriptlyst_user();

-- Generations table
CREATE TABLE IF NOT EXISTS scriptlyst_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES scriptlyst_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('script', 'video', 'thumbnail', 'idea')),
  content TEXT NOT NULL DEFAULT '',
  heygen_video_url TEXT,
  niche TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scriptlyst_generations_user_id ON scriptlyst_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_scriptlyst_generations_created_at ON scriptlyst_generations(created_at DESC);

-- Memberships table
CREATE TABLE IF NOT EXISTS scriptlyst_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES scriptlyst_profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scriptlyst_memberships_user_id ON scriptlyst_memberships(user_id);

-- Row-level security
ALTER TABLE scriptlyst_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scriptlyst_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scriptlyst_memberships ENABLE ROW LEVEL SECURITY;

-- Policies: users can only read/write their own rows
CREATE POLICY "scriptlyst_profiles: own rows" ON scriptlyst_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "scriptlyst_generations: own rows" ON scriptlyst_generations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "scriptlyst_memberships: own rows" ON scriptlyst_memberships FOR ALL USING (auth.uid() = user_id);

-- Service role bypass (for backend webhooks)
CREATE POLICY "scriptlyst_profiles: service role" ON scriptlyst_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "scriptlyst_generations: service role" ON scriptlyst_generations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "scriptlyst_memberships: service role" ON scriptlyst_memberships FOR ALL TO service_role USING (true) WITH CHECK (true);
`;

module.exports = { SCHEMA_SQL };
