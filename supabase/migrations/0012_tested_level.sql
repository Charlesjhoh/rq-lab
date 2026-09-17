-- 테스트에서 실제로 응시한 레벨(AR1~AR4)을 결과 행에 함께 저장한다.
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- 배경: 상위 레벨 테스트에서 "좌절(frustration)" 판정이 나오면 한 단계 아래 레벨을
-- 다시 권했는데, 그 학생이 예전에 이미 그 아래 레벨을 "독립(independent)" 판정으로
-- 통과했던 적이 있어도 구분 없이 매번 다시 권했다. 이걸 가리려면 "이 학생이 레벨 X를
-- 테스트해서 독립 판정을 받은 적이 있는가"를 조회할 수 있어야 하는데, 지금까지는
-- 어떤 레벨을 선택해서 테스트했는지가 DB에 남지 않아(final_ar만으로는 역산이 부정확함)
-- 조회가 불가능했다.
alter table reading_results add column if not exists tested_level text;

alter table reading_results drop constraint if exists reading_results_tested_level_check;
alter table reading_results add constraint reading_results_tested_level_check
  check (tested_level is null or tested_level in ('AR1', 'AR2', 'AR3', 'AR4'));
