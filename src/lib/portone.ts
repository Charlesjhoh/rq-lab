import { PaymentClient, Webhook } from '@portone/server-sdk';

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
// 서버에서 하는 결제는 모두 빌링키 결제다. channelKey를 생략하면 포트원이 빌링키를
// 발급한 채널로 결제하므로, PG를 바꿔도 기존 빌링키가 그대로 청구된다.

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

// currentCancellableAmount를 넘기면 포트원이 잔액이 일치할 때만 취소한다 — 같은 주문을 동시에
// 두 번 환불하려 해도 두 번째 요청은 잔액이 달라져 거부된다.
export async function cancelPayment(options: {
  paymentId: string;
  amount: number;
  reason: string;
  currentCancellableAmount: number;
}) {
  return getPaymentClient().cancelPayment({
    paymentId: options.paymentId,
    amount: options.amount,
    reason: options.reason,
    requester: 'ADMIN',
    currentCancellableAmount: options.currentCancellableAmount,
  });
}

// 포트원은 고객 ID로 결제를 검색할 수 없어 빌링키로 조회한다.
export async function getBillingKeyPayments(billingKey: string) {
  const { items } = await getPaymentClient().getPayments({
    page: { number: 0, size: 12 },
    filter: {
      storeId: STORE_ID,
      status: ['PAID', 'PARTIAL_CANCELLED', 'CANCELLED'],
      textSearch: [{ field: 'BILLING_KEY', value: billingKey }],
      sortBy: 'STATUS_CHANGED_AT',
      sortOrder: 'DESC',
    },
  });
  return items;
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
