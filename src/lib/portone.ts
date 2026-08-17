import { PaymentClient, Webhook } from '@portone/server-sdk';

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
const CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!;

function getApiSecret() {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) {
    throw new Error('포트원 API Secret이 설정되지 않았습니다.');
  }
  return secret;
}

function getPaymentClient() {
  return PaymentClient({ secret: getApiSecret(), storeId: STORE_ID });
}

export async function getPayment(paymentId: string) {
  return getPaymentClient().getPayment({ paymentId });
}

export async function payWithBillingKey(options: {
  paymentId: string;
  billingKey: string;
  orderName: string;
  amountTotal: number;
  customerId?: string;
}) {
  return getPaymentClient().payWithBillingKey({
    paymentId: options.paymentId,
    billingKey: options.billingKey,
    channelKey: CHANNEL_KEY,
    orderName: options.orderName,
    amount: { total: options.amountTotal },
    currency: 'KRW',
    customer: options.customerId ? { id: options.customerId } : undefined,
  });
}

export async function createPaymentSchedule(options: {
  paymentId: string;
  billingKey: string;
  orderName: string;
  amountTotal: number;
  timeToPay: string;
  customerId?: string;
}) {
  return getPaymentClient().paymentSchedule.createPaymentSchedule({
    paymentId: options.paymentId,
    payment: {
      billingKey: options.billingKey,
      channelKey: CHANNEL_KEY,
      orderName: options.orderName,
      amount: { total: options.amountTotal },
      currency: 'KRW',
      customer: options.customerId ? { id: options.customerId } : undefined,
    },
    timeToPay: options.timeToPay,
  });
}

export async function revokePaymentSchedules(scheduleIds: string[]) {
  return getPaymentClient().paymentSchedule.revokePaymentSchedules({ scheduleIds });
}

export async function deleteBillingKey(billingKey: string) {
  return getPaymentClient().billingKey.deleteBillingKey({ billingKey });
}

export async function verifyPortOneWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('포트원 웹훅 시크릿이 설정되지 않았습니다.');
  }
  return Webhook.verify(secret, rawBody, headers);
}
