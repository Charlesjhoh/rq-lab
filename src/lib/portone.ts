import { PaymentClient, Webhook } from '@portone/server-sdk';

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
// 서버에서 하는 결제는 모두 빌링키 결제다. channelKey를 생략하면 포트원이 빌링키를
// 발급한 채널(토스/이니시스)로 결제하므로 PG별로 채널을 고를 필요가 없다.

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
