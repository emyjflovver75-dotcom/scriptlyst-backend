const { createClient } = require('@supabase/supabase-js');

// Auth-only client (anon key) — used only for validating user JWTs
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin client (service role key) — bypasses RLS for all server-side DB writes
// Never expose this key to the frontend
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

module.exports = { supabase, supabaseAdmin };
