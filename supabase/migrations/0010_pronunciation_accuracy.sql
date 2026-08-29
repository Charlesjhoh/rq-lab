-- Azure 발음 평가(음소 단위 acoustic score)를 결과에 영구 저장.
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).
--
-- 배경: 이 값(pronunciationAccuracy)은 예전에 AR 레벨 계산에 과도한 영향을 줘서 계산식에서
-- 뺐는데(레벨은 현재 단어 일치율 기반 accuracy만 사용), 그 뒤로는 결과 화면에 한 번 보여주고
-- 버려지기만 했다 — reading_results에 저장 컬럼 자체가 없었다. 레벨 계산에는 계속 안 쓰지만,
-- 나중에 이해도 채점 때처럼 이상한 쏠림(경계값 anchoring 등)이 있는지 실제 데이터로 검증하거나
-- 리포트에 참고 지표로 노출하려면 우선 쌓아둬야 한다.
alter table reading_results add column if not exists pronunciation_accuracy numeric;
