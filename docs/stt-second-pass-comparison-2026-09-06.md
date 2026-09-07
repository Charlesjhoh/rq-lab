# 순수 받아쓰기 2차 패스 — 비용/정확도 비교 (2026-09-06)

## 질문

지금은 Azure에 **원문을 정답지로 함께** 줘서 발음평가를 받는다([pronunciation-analysis](pronunciation-analysis-2026-09-04.md) 1절).
그래서 전사본이 원문 쪽으로 정규화돼 **바뀐 단어·삽입 단어·어미 누락이 단어 레벨에서 안 보인다.**

→ **원문 없이 순수 받아쓰기(dictation)를 한 번 더 돌려서 전사본을 diff하면 잡히나?**
   비용은 얼마나 더 드나?

## 실험 도구

- `scripts/stt-compare.mjs <file.wav> [ref.txt]` — 한 녹음에 4개 엔진을 돌려 원문과 LCS 정렬,
  놓침/삽입/치환을 나란히 출력.
  - **A `azure-pa`** — Azure STT + PronunciationAssessment(enableMiscue). **현재 프로덕션.**
  - **B `azure-plain`** — Azure STT 순수 받아쓰기 (원문 안 줌)
  - **C `gpt4o`** — OpenAI `gpt-4o-transcribe` (원문 안 줌)
  - **D `whisper`** — OpenAI `whisper-1` (원문 안 줌)
- `scripts/tts-gen.mjs` — 스모크 테스트용 합성음성(깨끗한 낭독 / 일부러 틀린 낭독) 생성.
- reading-test 결과화면(dev) **"⬇ WAV+원문 저장"** 버튼 — Azure에 보낸 것과 **동일한 16k mono WAV**
  + 원문을 내려받아 `scripts/audio/` 에 넣고 하니스에 물린다. 실제 아이 녹음 수집용.

## 비용 (read당, 35초 낭독 기준)

| 방식 | 단가 | 35s read | 월 10,000 read |
|---|---|---|---|
| Azure 실시간 STT (PA 포함/미포함 동일) | $1.32 / hr | **$0.0128** | $128 |
| OpenAI `gpt-4o-transcribe` | $0.006 / min | $0.0035 | $35 |
| OpenAI `gpt-4o-mini-transcribe` | $0.003 / min | $0.0018 | $18 |
| OpenAI `whisper-1` | $0.006 / min | $0.0035 | $35 |

> Azure 발음평가는 **STT 요금과 동일** — 평가 기능 자체는 무료 애드온. 단, 발음평가는
> 저렴한 fast/batch 엔드포인트($0.66/hr)를 못 쓰고 실시간 엔드포인트만 된다.

단가 출처:
- Azure Pronunciation Assessment = STT 실시간 요금($1.32/hr), fast 엔드포인트 미지원 —
  [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5608069/pricing-and-usage-of-pronunciation-assessment-feat),
  [Azure Speech Service 2026 리뷰](https://blocksentient.com/review/microsoft-azure-speech-service/)
- OpenAI `gpt-4o-transcribe` $0.006/min · `gpt-4o-mini-transcribe` $0.003/min · `whisper-1` $0.006/min —
  [OpenAI Transcription pricing (2026)](https://costgoat.com/pricing/openai-transcription),
  [Whisper API pricing 2026](https://convertaudiototext.com/blog/openai-whisper-api-pricing-2026)

**2패스 시 read당 총비용 = 두 값의 합:**

| 조합 | read당 | 현재 대비 | 월 10k |
|---|---|---|---|
| A만 (현재) | $0.0128 | — | $128 |
| **A + B** (Azure plain) | $0.0256 | **+100%** | $256 |
| A + C (gpt-4o-transcribe) | $0.0163 | +27% | $163 |
| A + gpt-4o-mini-transcribe | $0.0146 | +14% | $146 |

## 정확도 — TTS 스모크 테스트 (⚠️ 상한선. 아이 녹음 아님)

원문 36단어. 일부러 넣은 오류 6개:
`barked→bark`(-ed누락) `chased→chase`(-ed누락) `small`(놓침) `red→big`(치환) `very`(삽입) `who called its name`(문장꼬리 스킵)

| 엔진 | match | 놓침 | 삽입 | 치환 (word-level) |
|---|---|---|---|---|
| A azure-pa (현재) | 30/36 | small, who/called/its/name | — | `red→back`(오전사) |
| **B azure-plain** | 28/36 | 〃 | **very ✓** | **`barked→bark` ✓, `chased→chase` ✓, `red→big` ✓** |
| C gpt4o | 30/36 | 〃 | — (very 놓침) | `red→big` ✓ |
| D whisper | 30/36 | 〃 | very ✓ | `red→big` ✓ |

깨끗한 낭독 → 4개 엔진 모두 36/36, 오탐 0.

### 읽히는 것

1. **순수 Azure 받아쓰기(B)가 가장 "곧이곧대로" 전사한다.** 이 실험에서 **-ed 누락을 단어
   레벨에서 잡은 유일한 엔진.** `bark`/`chase`라고 말하면 `bark`/`chase`로 적는다.
2. **OpenAI 모델(C/D)은 되레 "고쳐 쓴다".** 언어 사전확률이 강해서 `bark`라고 말해도
   `barked`로 복원 → **바로 이 용도엔 Azure보다 나쁨.** (Whisper 환각 성향과 같은 결)
3. 내용어 놓침·확실히 다른 치환은 어느 엔진이나 잡는다 (이건 지금 A도 잡음).
4. A(현재)가 `red`를 `back`으로 잘못 전사한 것처럼, **원문 편향 STT도 오전사는 낸다** —
   B의 diff로 교차검증하면 이런 것도 걸러낼 수 있다.

### 안 읽히는 것 (실험의 한계)

- **아이 음성이 진짜 관문이다.** TTS는 또렷한 성인 발음이라 쉬운 케이스. 더듬거리고
  액센트 있는 아이 영어 낭독에 원문 힌트 없이 순수 STT를 돌리면 **전사 자체가 망가져
  없는 오류를 지어낼** 수 있다 — [rework 문서](pronunciation-analysis-2026-09-04.md) 11절이
  경고하는 지점. 이건 실제 녹음으로만 잰다.

## 다음 단계 (실측)

1. reading-test를 dev로 띄우고 `?dbgPassage=<id>` 로 짧은 지문 고정.
2. **의도적으로 오류를 넣어** 5~10회 낭독, 매번 "⬇ WAV+원문 저장" → `scripts/audio/`.
3. `for f in scripts/audio/reading-*.wav; do node scripts/stt-compare.mjs "$f"; done`
4. B(azure-plain)의 놓침/삽입/치환이 **실제로 넣은 오류와 얼마나 맞는지 / 헛것을 얼마나
   잡는지** 집계.

## 구현 상태 (2026-09-07)

`PRONUN_SECOND_PASS=1` 플래그 뒤에 2차 패스 통합 완료 ([route.ts](../src/app/api/pronun/route.ts)).
플래그 off면 응답 JSON은 기존과 100% 동일.

- 1·2차 Azure 인식을 `Promise.all` 병렬. 2차 실패 시 `plainText=""` → 병합 no-op 폴백.
- **어미 누락**: 2차 전사가 굴절 원문 단어를 어간으로 읽고(barked→bark) 마지막 음소 <65면
  어미 누락으로 인정 (음소 3경로가 놓친 것 보강).
- **치환**: PA가 **자기 정렬에서 이미 `del+ins`로 잡은 자리만** 2차 전사로 보강 —
  2차도 다른 단어면 `azureGoodRefIdx` 필터 우회(the→a), 표시 단어는 2차 전사 우선
  (PA의 `red→back` 오전사 교정). **"독립 치환"(PA는 매칭됐는데 2차만 다름)은 안 넣음.**
- **삽입**(신규): 2차 전사에만 있는 3글자↑ 비disfluency 단어, 원문에 없고 읽은 구간 중간.
  `insertions: [{word, before}]` 응답 + 결과화면 violet 섹션.
- dev 결과화면에 2차 전사본(`plainRecognizedText`) 노출.

### 2026-09-07 1차 실측 (localhost, 사용자 낭독)

- **삽입 감지 잘 됨** (사용자 확인).
- **오탐: 깨끗이 읽은 `leaves`를 2차 STT가 `lived`로 받아써서 `leaves→lived` 치환으로
  떴다.** 문서가 경고한 그 실패 모드 — 순수 STT의 단어 오전사가 없는 오류를 만든다.
  → **독립 치환 로직 제거.** PA와 2차가 *함께* 틀린 자리만 신뢰. 어미 누락 stem 게이트도
  `last<65` → `<55`로 조임.

다음: 다시 실측 → 삽입/치환 오탐률 집계 → 임계값 튜닝 → 플래그 on.

## 방향 (실측 전 잠정)

- **가장 승산 있는 저비용안**: B(순수 Azure 받아쓰기)를 2차 패스로 추가하되, **B의 전사만
  믿지 말고** 교차검증에만 쓴다 — 어떤 단어를 치환/삽입으로 띄우는 건 (음소 신호가 약함)
  **AND** (B 전사본도 다르게 말함)일 때만. 신뢰도를 올리는 용도.
- 비용 +100%(Azure 라인 2배)가 실질적 걸림돌. gpt-4o-transcribe는 +27%로 싸지만
  over-correct라 이 용도엔 값을 못 한다.
- 최종 판단은 **아이 녹음 실측 숫자**가 나온 뒤.

## 출처

- [Pricing and usage of Pronunciation Assessment feature from Azure Speech-to-Text — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5608069/pricing-and-usage-of-pronunciation-assessment-feat)
- [Microsoft Azure Speech Service — 2026 Review: Pricing & Features](https://blocksentient.com/review/microsoft-azure-speech-service/)
- [OpenAI Transcribe & Whisper API Pricing (Sep 2026) — costgoat](https://costgoat.com/pricing/openai-transcription)
- [OpenAI Whisper API Pricing Per Minute in 2026 — convertaudiototext](https://convertaudiototext.com/blog/openai-whisper-api-pricing-2026)
- 내부: [발음/읽기 오류 감지 로직 (2026-09-04)](pronunciation-analysis-2026-09-04.md) — 원문 편향 STT의 구조적 한계(11절)
