const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth } = require('../middleware/auth');
const { generateScript } = require('../lib/claude');
const { createVideo, waitForVideo } = require('../lib/heygen');
const { buildPaymentLink } = require('../lib/stripe');
const { supabaseAdmin: supabase } = require('../lib/supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const router = express.Router();

// ─── General AI ───────────────────────────────────────────────────────────────

router.post('/ai', requireAuth, async (req, res, next) => {
  try {
    const { prompt, system, messages } = req.body;
    if (!prompt && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'prompt or messages is required' });
    }

    const msgs = messages || [{ role: 'user', content: prompt }];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      ...(system && { system }),
      messages: msgs,
    });

    res.json({ text: response.content[0].text });
  } catch (err) {
    next(err);
  }
});

// ─── Script Generation ───────────────────────────────────────────────────────

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const { niche, topic, style, length } = req.body;
    if (!niche || !topic) return res.status(400).json({ error: 'niche and topic are required' });

    const userId = req.user.id;

    // Check free tier daily limit
    const { data: profile } = await supabase
      .from('scriptlyst_profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (profile?.plan === 'free') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('scriptlyst_generations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'script')
        .gte('created_at', today.toISOString());

      if (count >= 3) {
        return res.status(429).json({
          error: 'Daily limit reached. Upgrade to Pro for unlimited generations.',
          upgrade_url: buildPaymentLink(userId),
        });
      }
    }

    const { script, tokensUsed } = await generateScript({ niche, topic, style, length });

    const { data: saved, error: saveError } = await supabase
      .from('scriptlyst_generations')
      .insert({
        user_id: userId,
        type: 'script',
        content: script,
        niche,
        topic,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (saveError) console.error('[generate] save error:', saveError.message);

    res.json({ script, tokens_used: tokensUsed, saved_id: saved?.id || null });
  } catch (err) {
    next(err);
  }
});

// ─── Video Generation ─────────────────────────────────────────────────────────

router.post('/generate-video', requireAuth, async (req, res, next) => {
  try {
    const { script, voiceId, avatarId } = req.body;
    if (!script) return res.status(400).json({ error: 'script is required' });

    const userId = req.user.id;

    const { data: profile } = await supabase
      .from('scriptlyst_profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (profile?.plan !== 'pro') {
      return res.status(403).json({
        error: 'Video generation requires a Pro membership.',
        upgrade_url: buildPaymentLink(userId),
      });
    }

    // Start HeyGen job — this returns immediately with a video_id
    const videoId = await createVideo({ script, voiceId, avatarId });

    // Respond immediately so the client can poll
    res.json({ heygen_video_id: videoId, heygen_status: 'processing', message: 'Video is being generated. Poll /api/video-status/:id for updates.' });

    // Fire-and-forget: wait for completion and save to DB
    waitForVideo(videoId).then(async (videoUrl) => {
      if (!videoUrl) return;
      await supabase.from('scriptlyst_generations').insert({
        user_id: userId,
        type: 'video',
        content: script.substring(0, 500),
        heygen_video_url: videoUrl,
        niche: 'video',
        topic: 'HeyGen output',
        created_at: new Date().toISOString(),
      });
    }).catch((err) => console.error('[generate-video] background error:', err.message));
  } catch (err) {
    next(err);
  }
});

router.get('/video-status/:videoId', requireAuth, async (_req, res, next) => {
  try {
    const { getVideoStatus } = require('../lib/heygen');
    const { videoId } = _req.params;
    const { status, videoUrl } = await getVideoStatus(videoId);
    res.json({ status, video_url: videoUrl });
  } catch (err) {
    next(err);
  }
});

// ─── History ──────────────────────────────────────────────────────────────────

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const { data, error, count } = await supabase
      .from('scriptlyst_generations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ generations: data, total: count });
  } catch (err) {
    next(err);
  }
});

router.delete('/history/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('scriptlyst_generations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Membership ───────────────────────────────────────────────────────────────

router.get('/membership/status', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data } = await supabase
      .from('scriptlyst_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json(data || { tier: 'free', is_active: true });
  } catch (err) {
    next(err);
  }
});

router.post('/membership/upgrade', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const plan = ['creator-monthly', 'pro-monthly'].includes(req.body?.plan)
      ? req.body.plan
      : 'pro-monthly';
    const redirectUrl = buildPaymentLink(userId, plan);
    res.json({ redirect_url: redirectUrl, plan });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
