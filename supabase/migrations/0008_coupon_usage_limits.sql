-- 쿠폰 사용 횟수 상한(max_uses)을 실제로 강제한다
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- 배경: coupons 테이블에 max_uses 컬럼이 있었지만 서버 코드가 아예 읽지 않아서, 활성 쿠폰은
-- 사실상 무제한으로 재사용할 수 있었다(특히 100% 할인 쿠폰이 freePass 남용으로 이어짐). 여기서는
-- 컬럼을 보강하고, "체크 후 증가"를 단일 UPDATE로 원자화한 redeem_coupon() 함수로 동시 요청에도
-- 안전하게 상한을 강제한다 — credit_packages CAS(0009 이전 credits/consume 수정)와 동일한 사상.

alter table coupons add column if not exists max_uses integer;
alter table coupons add column if not exists used_count integer not null default 0;

create or replace function redeem_coupon(p_coupon_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_redeemed boolean := false;
begin
  update coupons
  set used_count = used_count + 1
  where id = p_coupon_id
    and is_active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  returning true into v_redeemed;

  return coalesce(v_redeemed, false);
end;
$$;

-- 서버(service_role)만 호출하도록 제한 — anon/authenticated에 EXECUTE가 열려 있으면 클라이언트가
-- 직접 이 함수를 호출해 쿠폰 사용량을 인위적으로 소진시킬 수 있다.
revoke execute on function redeem_coupon(uuid) from public, anon, authenticated;
grant execute on function redeem_coupon(uuid) to service_role;
