const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const LINK_CREATOR = 'https://buy.stripe.com/bJe9AT8E8bET6no2Vl1gs05';
const LINK_PRO     = 'https://buy.stripe.com/eVqeVd1bG8sH7rs3Zp1gs06';

// plan: 'creator-monthly' ($17) | 'pro-monthly' ($37)
function buildPaymentLink(userId, plan = 'pro-monthly') {
  const base = plan === 'creator-monthly' ? LINK_CREATOR : LINK_PRO;

  if (!base) throw new Error(`No Stripe payment link configured for plan: ${plan}`);

  // Encode plan into client_reference_id so the webhook can identify the tier
  const ref = encodeURIComponent(`${userId}:${plan}`);
  return `${base}?client_reference_id=${ref}`;
}

function constructEvent(rawBody, sig) {
  return stripe.webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

module.exports = { stripe, buildPaymentLink, constructEvent };
