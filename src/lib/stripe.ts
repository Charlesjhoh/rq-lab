import Stripe from 'stripe';

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe API Key가 설정되지 않았습니다.');
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
}
