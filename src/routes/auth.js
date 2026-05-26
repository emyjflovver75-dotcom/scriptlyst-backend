const express = require('express');
const { supabase, supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    // Create profile row (admin client bypasses RLS for server-side insert)
    if (data.user) {
      await supabaseAdmin.from('scriptlyst_profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        plan: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await supabaseAdmin.from('scriptlyst_memberships').insert({
        user_id: data.user.id,
        tier: 'free',
        is_active: true,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    res.status(201).json({
      user: { id: data.user?.id, email: data.user?.email },
      token: data.session?.access_token || null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    res.json({
      user: { id: data.user.id, email: data.user.email },
      token: data.session.access_token,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabaseAdmin
      .from('scriptlyst_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: membership } = await supabaseAdmin
      .from('scriptlyst_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({ user: profile, membership: membership || { tier: 'free', is_active: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
