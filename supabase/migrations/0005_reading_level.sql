-- reading_results에 좌절/학습/독립 판정 라벨(reading_level) 저장
-- StepTestClient.calculateFinalAR()의 level 값을 그대로 저장해 결과 화면/교사 대시보드에서
-- "이 지문이 이 아이에게 너무 어려웠는지"를 이후에도 조회할 수 있도록 함.
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).

alter table reading_results
  add column if not exists reading_level text;

-- 기존 행 백필: calculateFinalAR()과 동일한 accuracy/comprehension 임계값으로 라벨만 채움.
-- final_ar 점수 자체는 소급 재계산하지 않는다(기존 방침 유지) — reading_level만 새로 채워
-- 과거 결과도 "이 지문이 어려웠는지" 필터/배지에 쓸 수 있게 한다.
update reading_results
set reading_level = case
  when accuracy < 90 or comprehension < 50 then 'frustration'
  when accuracy >= 95 and comprehension >= 70 then 'independent'
  else 'instructional'
end
where reading_level is null
  and accuracy is not null
  and comprehension is not null;
