-- Stripe → 포트원(PortOne) + 토스페이먼츠 전환에 필요한 컬럼 추가
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- 배경: 한국은 Stripe 직접 지원국이 아니라(실사업체가 있는 지원국에서만 계정 개설 가능) 국내 PG인
-- 포트원+토스페이먼츠로 전환한다. 기존 stripe_* 컬럼들은 과거 데이터 보존을 위해 그대로 두고,
-- 새 주문/구독은 아래 portone_* 컬럼을 사용한다.

alter table orders add column if not exists portone_payment_id text;

alter table teacher_subscriptions add column if not exists portone_billing_key text;
alter table teacher_subscriptions add column if not exists next_schedule_id text;
-- 정기 청구 웹훅이 같은 결제를 중복 처리하지 않도록(첫 결제는 subscriptions/checkout에서 동기
-- 처리, 정기 청구는 웹훅이 유일한 신호라 둘 다 여기로 들어올 수 있음) 마지막 처리한 paymentId를
-- 기록해 멱등성을 보장한다.
alter table teacher_subscriptions add column if not exists last_charged_payment_id text;
