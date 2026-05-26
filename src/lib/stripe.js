const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function buildPaymentLink(userId) {
  const base = process.env.STRIPE_PAYMENT_LINK;
  return `${base}?client_reference_id=${userId}`;
}

function constructEvent(rawBody, sig) {
  return stripe.webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

module.exports = { stripe, buildPaymentLink, constructEvent };
