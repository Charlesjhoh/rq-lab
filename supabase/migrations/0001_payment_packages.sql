-- 결제 내역 + 월 2회 패키지 기능을 위한 스키마 변경
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- ⚠️ 실행 전 확인: reading_results.id / orders.id 의 실제 타입이 uuid가 맞는지
-- Table Editor에서 확인하세요. bigint(자동증가 정수)라면 아래 uuid 참조 컬럼들을
-- 전부 bigint로 바꿔서 실행해야 합니다.

-- 1) orders: 상품 종류 + (단건 결제인 경우) 대상 리포트 id
alter table orders
  add column if not exists product_type text not null default 'single_report',
  add column if not exists result_id uuid references reading_results(id);

-- 2) reading_results: 프리미엄 리포트 잠금 해제 상태
alter table reading_results
  add column if not exists is_unlocked boolean not null default false,
  add column if not exists unlock_source text,
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlock_order_id uuid references orders(id);

-- 3) credit_packages: 월 2회 패키지 크레딧 원장 (구매 1건당 1행, 30일 롤링 만료)
create table if not exists credit_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  order_id uuid references orders(id),
  total_credits int not null default 2,
  remaining_credits int not null default 2,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists credit_packages_user_id_idx on credit_packages(user_id);

alter table credit_packages enable row level security;

drop policy if exists "credit_packages_select_own" on credit_packages;
create policy "credit_packages_select_own"
  on credit_packages for select
  using (auth.uid() = user_id);

-- insert/update는 service-role(서버)에서만 수행하므로 별도 write 정책 없음
