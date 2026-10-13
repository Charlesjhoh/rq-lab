// 포트원 V2 채널 목록 — 토스페이먼츠와 KG이니시스 심사를 동시에 받을 수 있도록
// 환경변수에 키가 설정된 PG만 결제창 선택지로 노출한다.
// NEXT_PUBLIC_* 값은 빌드 시 문자열로 치환되므로 반드시 리터럴로 참조해야 한다.

export type PgId = 'inicis' | 'toss';

export type PgChannel = {
  id: PgId;
  label: string;
  // 일반결제(단건) 채널
  channelKey?: string;
  // 정기결제(빌링키 발급) 채널
  billingChannelKey?: string;
};

const ALL_CHANNELS: PgChannel[] = [
  {
    id: 'inicis',
    label: 'KG이니시스',
    channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
    billingChannelKey: process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY,
  },
  {
    id: 'toss',
    label: '토스페이먼츠',
    channelKey: process.env.NEXT_PUBLIC_PORTONE_TOSS_CHANNEL_KEY,
    // 토스는 일반결제/빌링 채널을 따로 받지 않았다면 같은 채널을 쓴다.
    billingChannelKey:
      process.env.NEXT_PUBLIC_PORTONE_TOSS_BILLING_CHANNEL_KEY || process.env.NEXT_PUBLIC_PORTONE_TOSS_CHANNEL_KEY,
  },
];

export const PAYMENT_CHANNELS = ALL_CHANNELS.filter((c) => c.channelKey);
export const BILLING_CHANNELS = ALL_CHANNELS.filter((c) => c.billingChannelKey);
