-- profiles에 이용약관/개인정보처리방침 동의 시각 기록
-- 온보딩 화면에서 체크박스 동의를 받는데, 나중에 분쟁 시 "언제 동의했는지" 증빙이 필요할 수
-- 있어 단순 UI 체크에 그치지 않고 서버에도 남긴다.
-- Supabase SQL Editor에서 직접 실행하세요 (레포에 마이그레이션 도구가 없어 자동 적용이 안 됩니다).

alter table profiles
  add column if not exists terms_agreed_at timestamptz;
