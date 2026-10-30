-- 매니저 환불(전액/부분) 처리 기록용 컬럼
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- 배경: 이용약관 제7조에 따라 월 2회 패키지는 결제 후 7일 이내 미사용 크레딧을 부분환불한다
-- (결제금액 − 사용 크레딧 수 × 프리미엄 리포트 1회 정가). 부분환불은 주문 상태를 paid로 둔 채
-- 환불액만 기록해야 해서 별도 컬럼이 필요하다. 전액환불은 status = 'refunded'로도 표시된다.
-- 이 마이그레이션을 실행하기 전에는 매니저 환불 API가 주문 조회 단계에서 실패하므로(PortOne 취소
-- 호출 전) 돈만 환불되고 DB가 안 바뀌는 상황은 생기지 않는다.

alter table orders add column if not exists refunded_amount integer not null default 0;
alter table orders add column if not exists refunded_at timestamptz;
alter table orders add column if not exists refund_reason text;
alter table orders add column if not exists refunded_by uuid references auth.users(id);
