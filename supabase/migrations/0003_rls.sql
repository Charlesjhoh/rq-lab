-- 핵심 테이블에 RLS(행 단위 보안) 적용
-- Supabase SQL Editor에서 직접 실행하세요.
--
-- 원칙: 클라이언트(anon/authenticated 키)는 본인 행만 접근 가능.
-- teacher/manager가 타인 데이터를 봐야 하는 화면은 RLS를 우회하는 대신
-- service-role 서버 라우트(/api/teacher/*, /api/manager/*)로 이미 옮겨져 있음 —
-- 그 라우트들은 supabaseAdmin(service-role)을 쓰므로 RLS의 영향을 받지 않음.
--
-- 실제 프로젝트에 존재하지 않는 테이블(예: 레거시 user_permissions)이 있어도
-- 에러 없이 건너뛰도록 각 테이블을 존재 여부 체크 후 처리한다.

do $$
begin
  -- 1) profiles: 본인 행만 select/insert/update
  if to_regclass('public.profiles') is not null then
    execute 'alter table profiles enable row level security';

    execute 'drop policy if exists "profiles_select_own" on profiles';
    execute 'create policy "profiles_select_own" on profiles for select using (auth.uid() = id)';

    execute 'drop policy if exists "profiles_insert_own" on profiles';
    execute 'create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id)';

    execute 'drop policy if exists "profiles_update_own" on profiles';
    execute 'create policy "profiles_update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id)';
  end if;

  -- 2) reading_results: 본인 행만 select/insert
  if to_regclass('public.reading_results') is not null then
    execute 'alter table reading_results enable row level security';

    execute 'drop policy if exists "reading_results_select_own" on reading_results';
    execute 'create policy "reading_results_select_own" on reading_results for select using (auth.uid() = user_id)';

    execute 'drop policy if exists "reading_results_insert_own" on reading_results';
    execute 'create policy "reading_results_insert_own" on reading_results for insert with check (auth.uid() = user_id)';
  end if;

  -- 3) feedbacks: 본인 행 insert만 (select 하는 클라이언트 코드 없음)
  if to_regclass('public.feedbacks') is not null then
    execute 'alter table feedbacks enable row level security';

    execute 'drop policy if exists "feedbacks_insert_own" on feedbacks';
    execute 'create policy "feedbacks_insert_own" on feedbacks for insert with check (auth.uid() = user_id)';
  end if;

  -- 4) passages, books: 개인정보 아닌 공용 참조 데이터 — 로그인 유저 전체 read 허용
  if to_regclass('public.passages') is not null then
    execute 'alter table passages enable row level security';

    execute 'drop policy if exists "passages_select_authenticated" on passages';
    execute 'create policy "passages_select_authenticated" on passages for select using (auth.role() = ''authenticated'')';
  end if;

  if to_regclass('public.books') is not null then
    execute 'alter table books enable row level security';

    execute 'drop policy if exists "books_select_authenticated" on books';
    execute 'create policy "books_select_authenticated" on books for select using (auth.role() = ''authenticated'')';
  end if;

  -- 5) orders, coupons, payment_logs: 클라이언트가 직접 접근하지 않음 (전부 service-role 경유)
  -- RLS만 켜고 정책은 만들지 않음 -> anon/authenticated는 전부 차단, service-role만 통과
  if to_regclass('public.orders') is not null then
    execute 'alter table orders enable row level security';
  end if;

  if to_regclass('public.coupons') is not null then
    execute 'alter table coupons enable row level security';
  end if;

  if to_regclass('public.payment_logs') is not null then
    execute 'alter table payment_logs enable row level security';
  end if;

  -- 6) user_permissions: 레거시/미사용 테이블 — 존재할 때만 동일하게 잠금
  if to_regclass('public.user_permissions') is not null then
    execute 'alter table user_permissions enable row level security';
  end if;
end $$;

-- credit_packages는 migration 0001에서 이미 처리됨 (본인 행 select만 허용) — 변경 없음
