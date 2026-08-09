-- 선생님/클래스/좌석구독 기능을 위한 스키마 변경
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- ⚠️ 실행 전 확인: profiles.role에 CHECK 제약조건이 걸려 있다면 'teacher' 값이 이미
-- 허용되는지 확인하세요 (0002 마이그레이션에서 manager 추가 시 이미 다뤘던 제약).

-- 0) profiles: 선생님 자체가입 시 학생 전용 필드가 비어도 저장되도록 방어적 완화
--    (이미 nullable이면 drop not null은 안전한 no-op)
do $$
begin
  begin
    alter table profiles alter column student_name drop not null;
  exception when others then null;
  end;
  begin
    alter table profiles alter column parent_name drop not null;
  exception when others then null;
  end;
  begin
    alter table profiles alter column birth drop not null;
  exception when others then null;
  end;
end $$;

-- 1) classes: 선생님이 만드는 반
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id),
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_id_idx on classes(teacher_id);

-- 2) profiles: 학생이 소속되는 class(선택), 선생님 표시 이름
alter table profiles
  add column if not exists class_id uuid references classes(id),
  add column if not exists display_name text;

create index if not exists profiles_class_id_idx on profiles(class_id);

-- 3) teacher_subscriptions: 선생님 1명당 1행, 좌석(학생수) 구독 상태
create table if not exists teacher_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references auth.users(id),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  seat_count int not null default 0,
  status text not null default 'none', -- none|incomplete|trialing|active|past_due|canceled
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) RLS
alter table classes enable row level security;
-- 정책 없음: 클라이언트(anon/authenticated)는 전부 차단, service-role 서버 라우트
-- (/api/teacher/classes, /api/classes/join)만 통과 — orders/coupons와 동일 패턴.

alter table teacher_subscriptions enable row level security;

drop policy if exists "teacher_subscriptions_select_own" on teacher_subscriptions;
create policy "teacher_subscriptions_select_own"
  on teacher_subscriptions for select
  using (auth.uid() = teacher_id);

-- insert/update는 checkout/webhook 라우트(service-role)에서만 수행하므로 별도 write 정책 없음
