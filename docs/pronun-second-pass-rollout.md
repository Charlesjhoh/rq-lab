# `PRONUN_SECOND_PASS` — 순수 받아쓰기 2차 패스 운영 문서

리딩테스트 발음평가(`/api/pronun`)에 **원문 없이 순수 받아쓰기**를 한 번 더 돌려
치환·삽입·어미 누락 감지를 보강하는 기능. env 플래그로 켜고 끈다.

- 배경·비교 실험: [stt-second-pass-comparison-2026-09-06.md](stt-second-pass-comparison-2026-09-06.md)
- 감지 로직 전체: [pronunciation-analysis-2026-09-04.md](pronunciation-analysis-2026-09-04.md)
- 구현: [`src/app/api/pronun/route.ts`](../src/app/api/pronun/route.ts) (커밋 8ac3b15)

## 플래그

| 값 | 동작 |
|---|---|
| 미설정 / `1` 아닌 값 | **기본.** 2차 패스 안 돎. 응답 JSON은 기존과 100% 동일 |
| `1` | 2차 패스 ON. Azure 호출 2배, 결과 화면에 삽입 섹션 추가 + 치환·어미 누락 강화 |

플래그 off면 병합 로직이 전부 no-op이라 **회귀 위험 없음**.

## 켜기 (app.readeb.com)

1. Vercel → 프로젝트 → **Settings → Environment Variables**
2. `PRONUN_SECOND_PASS` = `1`, Environment = **Production**
3. **Deployments → 최신 배포 → ⋯ → Redeploy** (env 변경은 새 배포부터 적용)

Preview에서도 쓰려면 Environment에 Preview 추가.

## 끄기

`PRONUN_SECOND_PASS` 변수를 **삭제**(또는 값을 `0`) → Redeploy.

## 비용

- 순수 받아쓰기 = Azure 실시간 STT, 발음평가와 **동일 단가**($1.32/hr).
- 리딩테스트 낭독 1건: **~$0.0128 → ~$0.0256** (35초 기준, 딱 2배).
- 2배가 되는 건 **`/api/pronun` (낭독 채점)** 뿐. 이해도(recall) 등 다른 Azure 호출은 그대로.
- **플래그 켜 있는 동안만.** 실측 끝나면 반드시 끈다.

## 켠 뒤 확인할 것

결과 화면(리딩테스트 완료 후):

1. **깨끗하게 읽었을 때 오탐이 없는가** — 특히 "다른 단어로 바꿔 읽은 단어"에
   멀쩡히 읽은 단어가 뜨면 안 됨 (2026-09-07에 `leaves→lived` 오탐 → 독립 치환 제거함).
2. **일부러 넣은 오류를 잡는가** — 없는 단어 삽입 / `-ed`·`-s` 빼고 읽기 / 다른 단어로 읽기.
3. dev(localhost)에서는 결과 화면 상단 "[dev] 2차 전사(순수)" 텍스트로 2차 STT가
   실제로 뭘 들었는지 확인 가능. prod에선 안 보임.

로컬에서 여러 엔진 비교: 결과 화면 "⬇ WAV+원문 저장" → `node scripts/stt-compare.mjs <wav>`.

## 판단 기준 (계속 쓸지)

- 삽입·치환·어미 누락 **오탐률**이 낮고(깨끗한 낭독에서 거의 0), 실제 오류 **검출률**이
  1패스보다 눈에 띄게 높으면 → 플래그 기본 on 전환 고려.
- 그 전에 비용 최적화: 2차 패스를 Azure **fast transcription REST**($0.66/hr, 절반)로
  교체하면 총비용 +100% → +50%로 낮출 수 있음 (별도 작업).

## 현재 상태

- 2026-09-07: main 배포됨(8ac3b15), 플래그 **미설정 = off**. 1차 실측에서 삽입 감지 양호,
  치환 오탐 1건 발견 후 독립 치환 로직 제거. prod 실측 대기 중.
- DB·점수·`/report` 미반영 — 신규 신호는 결과 화면 표시만.
