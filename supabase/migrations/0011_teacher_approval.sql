-- 선생님 가입 승인 절차 추가
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- 배경: 지금까지는 온보딩에서 "선생님으로 가입"을 누르면 서버 검증 없이 곧바로
-- role='teacher'가 부여되고 클래스 관리 기능 전체에 접근할 수 있었다. 매니저가 검토 후
-- 승인/거절할 수 있도록 teacher_status를 추가한다.
--
-- 기존에 이미 role='teacher'인 계정은 그동안 별다른 문제 없이 운영되어 온 것이므로
-- 이번 변경으로 갑자기 잠기지 않도록 approved로 소급 처리한다(그랜드파더링).

alter table profiles add column if not exists teacher_status text;

alter table profiles drop constraint if exists profiles_teacher_status_check;
alter table profiles add constraint profiles_teacher_status_check
  check (teacher_status is null or teacher_status in ('pending', 'approved', 'rejected'));

update profiles
set teacher_status = 'approved'
where role = 'teacher' and teacher_status is null;

create index if not exists idx_profiles_pending_teachers
  on profiles (role, teacher_status)
  where role = 'teacher';

-- profiles_update_own RLS 정책(0003_rls.sql)은 auth.uid() = id만 검사하고 컬럼은 제한하지
-- 않는다. 즉 이 트리거가 없으면 로그인한 아무나 브라우저 콘솔에서
-- `supabase.from('profiles').update({ teacher_status: 'approved' })`를 호출해 승인 절차를
-- 그냥 우회할 수 있다. 매니저 승인 API(/api/manager/teachers/decision)는 service-role 키를
-- 쓰므로 통과하고, SQL Editor 등 DB에 직접 접속하는 관리 작업(auth.role()이 비어있음)도
-- 통과한다 — anon/authenticated로 들어오는 브라우저발 요청만 approved/rejected로의 변경을 막고
-- 온보딩의 최초 pending 저장은 그대로 허용한다.
create or replace function public.guard_teacher_status()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() in ('anon', 'authenticated') then
    if new.teacher_status is not null and new.teacher_status <> 'pending' then
      if tg_op = 'UPDATE' then
        new.teacher_status := old.teacher_status;
      else
        new.teacher_status := 'pending';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_teacher_status_trigger on profiles;
create trigger guard_teacher_status_trigger
  before insert or update on profiles
  for each row
  execute function public.guard_teacher_status();
