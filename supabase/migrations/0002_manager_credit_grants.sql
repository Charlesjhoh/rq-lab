-- 매니저 결제 관리 페이지 (결제 검색/통계 + 무료 크레딧 수동 지급)를 위한 스키마 변경
-- Supabase SQL Editor에서 직접 실행하세요.
--
-- ⚠️ profiles.role에 CHECK 제약조건이 걸려 있다면 'manager' 값도 허용하도록
-- 미리 확인/수정해 주세요 (예: alter table profiles drop constraint ...; 후 재생성).
-- manager 권한 부여는 teacher와 동일하게 대상 유저의 profiles.role을 'manager'로
-- 직접 업데이트하면 됩니다: update profiles set role = 'manager' where id = '<대상 uuid>';

alter table credit_packages
  add column if not exists source text not null default 'purchase', -- 'purchase' | 'manual_grant'
  add column if not exists granted_by uuid references auth.users(id),
  add column if not exists note text;
