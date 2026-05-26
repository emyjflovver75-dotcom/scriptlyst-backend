const express = require('express');
const { constructEvent } = require('../lib/stripe');
const { supabaseAdmin: supabase } = require('../lib/supabase');

const router = express.Router();

// Raw body required for Stripe signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = constructEvent(req.body, sig);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const customerId = session.customer;
    const subscriptionId = session.subscription;

    if (!userId) {
      console.error('[webhook] No client_reference_id in session:', session.id);
      return res.sendStatus(200);
    }

    try {
      const now = new Date().toISOString();

      // Deactivate old memberships
      await supabase
        .from('scriptlyst_memberships')
        .update({ is_active: false })
        .eq('user_id', userId);

      // Insert new Pro membership
      await supabase.from('scriptlyst_memberships').insert({
        user_id: userId,
        tier: 'pro',
        is_active: true,
        started_at: now,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        created_at: now,
      });

      // Update profile
      await supabase
        .from('scriptlyst_profiles')
        .update({
          plan: 'pro',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          updated_at: now,
        })
        .eq('id', userId);

      console.log(`[webhook] Pro membership granted to user ${userId}`);
    } catch (err) {
      console.error('[webhook] DB update failed:', err.message);
      return res.status(500).send('Database error');
    }
  }

  res.sendStatus(200);
});

module.exports = router;
