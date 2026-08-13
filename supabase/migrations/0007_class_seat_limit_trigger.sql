-- 클래스 참여코드 가입 시 좌석 정원 초과를 DB 레벨에서 강제
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- 배경: /api/classes/join이 "현재 인원 수 확인 → profiles.class_id 갱신"을 두 개의
-- 별도 쿼리로 처리해서, 학생 여러 명이 거의 동시에 같은 참여코드로 가입하면(신학기
-- 단체 가입 등) 둘 다 "아직 자리 있음"을 보고 통과해버려 결제한 좌석 수보다 많은
-- 학생이 들어갈 수 있었다. API 레벨에서는 이 체크-후-쓰기를 원자적으로 만들 수 없어서,
-- teacher_subscriptions 행을 잠그고 그 안에서 인원수를 세는 트리거로 막는다 — 같은
-- 선생님에 대한 동시 가입 요청은 이 잠금 때문에 직렬화되어 순서대로 처리된다.

create or replace function enforce_class_seat_limit()
returns trigger
language plpgsql
as $$
declare
  v_teacher_id uuid;
  v_seat_count int;
  v_status text;
  v_current_count int;
begin
  select teacher_id into v_teacher_id from classes where id = new.class_id;

  if v_teacher_id is null then
    return new; -- 존재하지 않는 class_id는 FK 제약이 별도로 막는다
  end if;

  -- 같은 선생님 앞으로 오는 동시 가입 요청을 이 잠금으로 직렬화한다
  select seat_count, status into v_seat_count, v_status
  from teacher_subscriptions
  where teacher_id = v_teacher_id
  for update;

  if v_status is null or v_status not in ('active', 'trialing') then
    raise exception '선생님의 좌석이 활성화되어 있지 않습니다.' using errcode = 'P0001';
  end if;

  select count(*) into v_current_count
  from profiles p
  join classes c on c.id = p.class_id
  where c.teacher_id = v_teacher_id
    and p.id <> new.id;

  if v_current_count >= v_seat_count then
    raise exception '선생님의 좌석이 모두 사용 중입니다.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_class_seat_limit on profiles;
create trigger trg_enforce_class_seat_limit
  before insert or update of class_id on profiles
  for each row
  when (new.class_id is not null)
  execute function enforce_class_seat_limit();
