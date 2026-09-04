# 발음/읽기 오류 감지 로직 (2026-09-04)

리딩테스트에서 아이가 지문을 소리 내어 읽은 녹음을 분석해 **놓친 단어 / 바꿔 읽은
단어 / 어미(-ed·-s)를 빠뜨린 단어**를 찾아내고, **읽기 정확도·발음 정확도** 점수를
매기는 로직 정리. 구현은 [`src/app/api/pronun/route.ts`](../src/app/api/pronun/route.ts).

## 요약

*(약자는 아래 "용어 정리" 참고. LCS = 두 단어열을 최적으로 나란히 맞추는 정렬 방법, 3절.)*

| 오류 유형 | 감지 방식 | 신뢰도 |
|---|---|---|
| 놓친 단어 (통째 스킵) | LCS 정렬 + Azure 인식 여부 | 내용어는 높음, 기능어는 중간 |
| 바꿔 읽은 단어 (치환) | LCS 정렬에서 "빠진 원문 단어 + 그 자리에 생긴 다른 단어" 짝짓기 | "확실히 다른 단어"만 — 그 외는 못 잡음 |
| 어미 누락 (-ed / -s) | Azure 음소 단위 점수 | ~4/5, 녹음마다 편차 |
| 삽입 (없는 단어 추가) | **화면에 표시 안 함** | ASR이 삽입어를 버려서 불가 |
| 발음 품질 (단어별 오발음) | Azure 단어 점수 → 점수에만 반영 | 개별 단어 지목은 안 함(노이즈 과다) |

핵심 제약: **Azure STT가 아이의 근사한 발음을 "제대로 된 영어"로 재구성**한다. 빠뜨린
어미를 복원하고, 건너뛴 기능어를 채우고, 관사(`a`↔`the`)를 정규화한다. 그래서 단어 레벨
비교로는 이런 오류가 안 보이고, 음소 레벨 신호(어미 누락)와 "전사가 확실히 다른" 경우
(치환)만 잡을 수 있다.

---

## 용어 정리

| 약자/용어 | 풀이 | 이 문서에서의 의미 |
|---|---|---|
| **STT** (Speech-to-Text) | 음성 → 텍스트 변환 | 아이 녹음을 글자로 옮기는 것 |
| **ASR** (Automatic Speech Recognition) | 자동 음성 인식 | STT와 같은 뜻으로 씀 (Azure의 인식 엔진) |
| **전사본 / transcript** | ASR이 받아쓴 결과 텍스트 | 아이가 "말한" 것으로 간주하는 문자열 |
| **원문 / reference** | 지문 텍스트 | 아이가 "읽어야 할" 정답 문자열 |
| **토큰 / token** | 공백으로 자른 단어 하나 | "The cat" → `["the", "cat"]` |
| **정규화 / normalize** | 비교하기 좋게 다듬기 | 소문자화·문장부호 제거·축약형 풀기 |
| **음소 / phoneme** | 말소리의 최소 단위 | "cat" = /k/ /æ/ /t/ 세 음소. Azure가 음소마다 점수를 줌 |
| **어간 / stem** | 단어에서 어미를 뺀 부분 | "walked"의 어간 = "walk" |
| **어미 / 굴절 어미 (inflectional suffix)** | 문법 기능을 더하는 끝소리 | 과거형 `-ed`, 복수·3인칭 `-s` |
| **LCS** (Longest Common Subsequence, 최장 공통 부분수열) | 두 수열에서 순서를 지키며 공통으로 뽑을 수 있는 가장 긴 부분 | 원문 단어열과 전사본 단어열을 "가장 많이 겹치게" 짝지어, 어디가 빠졌고 어디가 바뀌었는지 알아내는 정렬 방법 (아래 3절 참고) |
| **DP** (Dynamic Programming, 동적 계획법) | 작은 문제 답을 표에 저장해 큰 문제를 푸는 기법 | LCS를 계산하는 방법 |
| **op / 연산** (`match` / `del` / `ins`) | 정렬 결과를 되짚을 때 나오는 동작 | `match`=같음, `del`=원문에만 있음(=안 읽음), `ins`=전사본에만 있음(=끼워 읽음) |
| **치환 / substitution** | 원문 X 자리에 다른 단어 Y를 읽음 | 정렬에서 `del`+`ins`가 붙어 나온 것 |
| **삽입 / insertion** | 원문에 없는 단어를 끼워 읽음 | 정렬의 `ins` |
| **생략 / omission** | 원문 단어를 안 읽음 = "놓친 단어" | 정렬의 `del` |
| **오발음 / Mispronunciation** | 읽긴 읽었는데 소리가 틀림 | Azure `ErrorType` 중 하나 |
| **편집 거리 / edit distance (Levenshtein)** | 한 문자열을 다른 문자열로 바꾸는 데 필요한 최소 글자 편집 횟수 | "cat"→"cap" = 1. 치환 오탐(사소한 슬립)을 거르는 데 씀 |
| **동음이의어 / homophone** | 소리는 같고 뜻·철자가 다른 단어 | their/there, to/too. 오디오로는 구분 불가 → 치환에서 제외 |
| **기능어 / function word** | 관사·전치사·대명사 등 문법용 단어 | the, a, of, its, to, in… |
| **내용어 / content word** | 명사·동사·형용사 등 뜻을 나르는 단어 | dog, run, happy… |
| **WPM** (Words Per Minute) | 분당 읽은 단어 수 | 읽기 속도 지표 |
| **커버리지 / completeness** | 지문 중 실제로 읽은 비율 | 20단어 중 15단어 읽음 = 0.75 |

---

## 1. 입력: Azure Speech

Azure의 **발음 평가(Pronunciation Assessment)** 기능을 이렇게 설정해서 쓴다:

```
PronunciationAssessmentConfig(
  원문 텍스트,
  HundredMark,        // 100점 만점 채점
  Phoneme,            // 음소 단위까지 채점 (어미 누락 감지에 필수)
  enableMiscue=true   // 원문 대비 생략/삽입/치환을 표시하도록
)
```

**연속 인식(continuous recognition)** = 한 문장씩 끊지 않고 녹음 전체를 계속 인식하는
모드. 문단 낭독이라 이 모드를 쓴다. 두 종류의 데이터가 나온다:

1. **ASR 전사본** (`collectedText`) — 아이가 말한 것을 Azure가 텍스트로 옮긴 것.
   원문 편향이 강하다(원문에 맞춰 인식).
2. **단어·음소 단위 채점** — 인식 도중 `recognized` 콜백이 발화 구간마다 호출되고,
   그때 오는 JSON(`NBest[0].Words`)에 단어별 점수(`AccuracyScore`)와 오류 유형
   (`ErrorType` = None / Mispronunciation / Omission / Insertion), 그리고 단어를 이루는
   음소마다의 점수가 들어 있다.

### 설정상 주의점

- **구간 종료 무음 = 1.5초** (`Speech_SegmentationSilenceTimeoutMs`). 기본 500ms면
  아이가 단어 사이에 뜸을 들일 때 문장 중간에서 인식이 끊겨 뒷부분이 통째로
  누락되고, 그게 "놓친 단어"로 잘못 잡혔다.
- **연속 모드에서는 `ErrorType: "Omission"`을 안 내보낸다** (실측). 즉 Azure는 "안 읽은
  단어"를 알려주지 않는다. 그래서 "놓친 단어"는 아래 LCS 전사본 정렬로 직접 찾는다.
- **연속 모드에서 `AccuracyScore`가 구간마다 온다.** 콜백마다 덮어쓰면 마지막 구간
  점수만 남아 앞부분을 아무리 틀려도 뒤만 잘 읽으면 높게 나온다 → 전부 누적한다.

---

## 2. 텍스트 정규화 (`normalize`)

원문과 전사본을 같은 방식으로 토큰화:

```
소문자 → n't를 " not"으로 → 's를 " is"로 → [a-z] 아닌 문자를 공백으로 → 공백 분리
```

숫자·문장부호는 제거된다. (예: "10" → 사라짐, "don't" → "do not")

---

## 3. 시퀀스 정렬 (LCS)

### 무슨 문제를 푸는가

원문 단어열과 전사본 단어열을 나란히 놓고 **"어디가 같고, 어디가 빠졌고, 어디가
바뀌었는지"**를 알아내야 한다. 단순히 앞에서부터 하나씩 비교하면, 아이가 단어
하나만 건너뛰어도 그 뒤가 전부 한 칸씩 밀려서 "다 틀렸다"고 나온다.

**LCS (최장 공통 부분수열)** = 두 열에서 **순서를 지키면서** 공통으로 뽑을 수 있는
가장 긴 단어 나열. 이걸 찾으면 나머지(공통이 아닌 부분)가 곧 오류다.

### 예시

```
원문   : the  cat  sat  on  the  mat
전사본 : the  cat       on  a    mat
```

LCS = `the cat on mat` (4단어). 이걸 축으로 정렬하면:

```
the  cat  sat   on   the   mat
the  cat  (없음) on   a     mat
          ↑             ↑
          del          del + ins  →  "the"를 "a"로 바꿔 읽음(치환)
          (sat 놓침)
```

→ `sat` = 놓친 단어, `the→a` = 바꿔 읽은 단어.

> 예전엔 "앞에서부터 훑으며 12단어 창 안에서 같은 단어 찾기"(그리디) 방식이었는데,
> `the/a/and/on/i` 같은 흔한 단어가 **뒤쪽에 있는 같은 단어**에 잘못 매칭되면 포인터가
> 확 앞서나가, 그 사이에 아이가 제대로 읽은 단어들이 전부 "놓친 단어"로 잡히는
> 버그가 있었다. LCS는 열 전체를 보고 최적으로 맞추므로 이 문제가 없다.

### 어떻게 계산하나 (DP)

`dp[i][k]` = `refWords[i..]`와 `spokenWords[k..]`의 LCS 길이. 표를 뒤에서부터 채운다:

```
refWords[i] === spokenWords[k]  →  dp[i][k] = dp[i+1][k+1] + 1   (둘 다 소비하고 +1)
아니면                          →  dp[i][k] = max(dp[i+1][k], dp[i][k+1])  (한쪽만 소비)
```

표를 다 채운 뒤 `(0,0)`부터 앞으로 되짚으며(backtrack) **연산 시퀀스** `ops`를 만든다:

- `match` — 두 단어가 같음. 둘 다 전진
- `del` — 원문 단어를 건너뜀 (전사본에 없음 = 안 읽었거나 다르게 읽음)
- `ins` — 전사본 단어를 건너뜀 (원문에 없음 = 끼워 읽었거나 다르게 읽음)

`matchedRefIdx` = `match`로 짝지어진 원문 단어 인덱스 집합.

---

## 4. "이 원문 단어를 읽었는가" 판정 (`readRef[]`)

원문 단어 하나가 "읽힌 것"으로 인정되는 조건 = **(a) OR (b)**:

- (a) LCS 정렬에서 매칭됨 (`matchedRefIdx`)
- (b) Azure가 그 단어를 인식함 — `azureWords`를 원문 순서대로 앞으로만 스캔하며
  10단어 창 안에서 매칭. `ErrorType`이 `Insertion`/`Omission`이 아니면 인정
  (Mispronunciation도 "읽긴 읽은 것"이므로 포함).

둘 다 아니면 → **안 읽음**.

### 부수 산출물

- **`azureGoodRefIdx`** — `ErrorType === "None"` 이고 `AccuracyScore >= 72`인 위치.
  "Azure가 확실히 제대로 읽었다고 본" 단어. 아래 치환 판정에서 ASR 노이즈(멀쩡히
  읽은 단어가 다르게 전사된 것)를 걸러내는 데만 쓴다.
  > 임계값이 72인 이유: 아이가 `the`를 `a`로 읽어도 Azure가 62점을 주더라. 55로
  > 두면 그런 진짜 오류가 "정상"으로 분류돼 치환 감지가 막혔다.

- **`lastReadRef`** — `Max(matchedRefIdx)`. "어디까지 읽었나"의 경계.
  > `readRef` 전체(Azure 인식 포함)로 경계를 잡으면, 아이가 도중에 멈췄을 때
  > 전사본 끝의 흔한 단어("her rock")가 뒤쪽 원문 위치에 잘못 붙어 경계가 꼬리까지
  > 늘어나고, 안 읽은 마지막 문장이 통째로 "놓친 단어"로 새어나왔다. LCS 매칭만
  > 쓰면 안전하다.

---

## 5. 놓친 단어 (`missedWords` → `uniqueMissed`)

```
for 원문 단어 i:
  if readRef[i] and not 치환됨(i):  continue        # 읽음
  wrongWords.push(refWords[i])                       # 커버리지 계산용(꼬리 포함)
  if i < lastReadRef and not 치환됨(i):
     missedWords.push(refWords[i])                    # 화면 표시용(꼬리 제외)
```

- **`wrongWords`** = 안 읽은 단어 전부. 못다 읽은 뒷부분(꼬리)까지 포함 → 읽기
  커버리지·WPM 계산에 씀.
- **`missedWords`** = 마지막으로 읽은 단어 **앞**에 있는 진짜 공백만. 아이가 도중에
  멈춰서 못 읽은 뒷부분은 "놓친 단어"가 아니라 "미완독"이므로 화면에서 제외.

### 화면 표시 필터 (`uniqueMissed`)

- **1글자 제외** (`w.length >= 2`) — `a`, `i`는 ASR가 워낙 자주 흘려서 노이즈.
- 어미 누락·치환으로 이미 잡힌 단어 제외 (중복 방지).
- **기능어(the/a/at 등)는 그대로 노출** — 아이가 일부러 건너뛰면 실제 읽기 오류다.
  (2~4글자 기능어 스킵은 ASR가 종종 채워넣어서 못 잡는 경우가 많지만, 못 잡을 뿐
  잡힌 건 진짜다.)

---

## 6. 바꿔 읽은 단어 (치환, `substitutions` → `uniqueSubstitutions`)

**치환** = 원문의 어떤 단어를 빼먹은 게 아니라, 그 자리에 **다른 단어를 읽은** 것.
정렬(`ops`)에서 보면 `del`(원문 단어 하나가 없어짐)과 `ins`(그 자리에 다른 단어가 생김)이
**나란히** 나온다.

`ops`에서 `match`가 아닌 연산이 연달아 나오는 구간(**비매칭 블록**)을 찾아, 그 안의
`del`(원문 단어)과 `ins`(전사 단어)를 **순서대로 짝지어** `from → to` 치환 후보로 본다.
블록에 `del`이 2개·`ins`가 1개면 1쌍만 치환, 남은 `del` 1개는 순수 누락(놓친 단어).

### 오탐 필터 (전부 통과해야 치환으로 인정)

| 필터 | 목적 |
|---|---|
| `refIdx <= lastReadRef` | 미완독 꼬리 제외 |
| `!azureGoodRefIdx.has(refIdx)` | Azure가 원문 단어를 잘 읽었다고 확인했으면 = ASR 전사 노이즈 |
| `!isHomophone(from, to)` | their/there, to/too… 소리가 같으면 오디오로 못 잡음 (정적 목록) |
| `editDist(from, to) > 1` | 1글자 차이는 오탐/사소한 슬립 |
| `!(from.length<=2 && to.length>=5)` | `a → elephant` 같은 짧은→긴 단어는 ASR 노이즈 확률 높음 |
| 단어 쪼개짐(split artifact) 아님 | ASR이 한 단어를 둘로 잘못 받아쓴 경우(`windowsill` → "window" + "sill")를 걸러냄: 블록에 `ins`가 `del`보다 많고, 전사 단어가 원문 단어로 시작하거나 그 반대일 때 |

### 표시

`{ from, to, before }` — `before`는 원문에서 바로 앞 단어. 같은 `the`가 여러 번 나올 때
어느 위치인지 알 수 있게 `"to the → to a"`처럼 표시. 중복 제거 키 = `before|from|to`
(위치가 다르면 각각 표시).

### 못 잡는 것

- **발음이 비슷한 치환** (`walk`↔`walked`, `cap`↔`cat`) — Azure가 원문 단어의
  오발음으로 처리하고 ASR도 원문대로 전사 → del/ins 자체가 안 생김. 발음 점수에만 반영.
- **`the → a` 스왑** — ASR이 관사를 원문 쪽("the")으로 정규화하면 전사에 차이가 없음.
  ASR이 실제로 "a"로 전사해야만 잡힌다.

---

## 7. 어미 누락 (-ed / -s, `endingDropScores` → `uniqueEndingDrops`)

ASR은 어미를 빼먹어도 원문 단어로 인식한다("walk" → "walked"). 그래서 단어 레벨로는
못 잡고, **Azure의 음소 단위 점수**로만 잡힌다.

### 대상 단어 (`looksInflected` = "굴절 어미가 붙은 것으로 보이는 단어")

- `-ed`로 끝남 (4글자 이상 — "bed", "red" 같은 짧은 단어 제외), 또는
- `-s`로 끝남 (4글자 이상, 단 `-ss`/`-us`/`-is`로 끝나면 굴절 어미가 아니라 원래 철자
  이므로 제외 — "glass", "bus", "this")
- `SUFFIX_LOOKALIKES` 목록(this, was, goes, bread…) 제외 — 위 규칙을 통과하지만
  굴절형이 아닌 흔한 단어들

### 판정

용어: `phonemeScores` = 그 단어를 이루는 음소마다 Azure가 준 점수 배열.
`last` = 마지막 음소 점수(≈ 어미 소리), `stem` = 마지막을 뺀 나머지(≈ 어간 소리),
`stemMean` = 어간 음소 점수 평균, `단어총점` = Azure가 그 단어 전체에 준 점수.

세 경로 중 하나라도 만족하면 "어미 누락":

| 경로 | 조건 | 의도 |
|---|---|---|
| `relDrop` (상대 하락) | `stemMean>=45` & `last<55` & `last <= stemMean-20` & `단어총점<78` | 어간은 그럭저럭 살아있는데 끝 음소만 어간보다 20점 이상 뚝 떨어짐 |
| `hardZero` (끝소리 0) | `stemMean>=60` & `last<12` | 어간은 확실히 잘 읽었는데 끝 음소가 거의 0 → 단어총점이 높아도 어미는 확실히 빠진 것 (예: `smiles` 음소 `[71,75,69,51,0]`) |
| `mushyEnding` (뭉갠 어미) | `단어총점<45` & `last<40` & `last <= 최저음소` | 단어 전체가 약한데 그중에서도 끝 음소가 제일 낮음 → 어간까지 뭉갠 상태에서 어미도 빠진 것 (예: `plays` 음소 `[45,53,37,37]`) |

> 실측: 어미를 빼먹어도 Azure는 그 음소를 0이 아니라 **40~50점**으로 준다. 절대값
> `<25`만 보면 대부분 놓친다. 그래서 "어간 대비 상대 하락"이 주 신호.

최대 6개, 마지막 음소 점수 낮은 순.

---

## 8. 삽입 (없는 단어 추가) — 표시 안 함

- `azureWords`의 `ErrorType === "Insertion"` 항목은 발음 점수 집계(`assessedWordScores`)
  에서 **제외** (원문에 없는 단어가 점수를 왜곡하면 안 됨).
- 화면에는 **표시하지 않는다.** 이유: ASR이 아이가 끼워 넣은 단어를 대부분 버리고,
  게다가 ASR이 한 단어를 둘로 쪼갠 것(`windowsill → window sill`)이 삽입으로
  잡혀 노이즈가 많다.

---

## 9. 점수

### 읽기 정확도 (`readingAccuracy`)

```
correctReadCount = readRef 중 (읽음 AND 치환 안 됨) 개수
readingAccuracy = round(correctReadCount / R * 100)
```

치환한 단어는 "정확히 읽은 것"이 아니므로 뺀다.

### 발음 정확도 (`pronunciationScore`)

```
wordAccuracy   = (구간평균 segMean + 단어평균 wordMean) / 2
completeness   = correctReadCount / R
pronunciationScore = round(wordAccuracy * sqrt(completeness))
```

- **구간평균**(`segmentAccuracies`) = Azure가 구간별로 준 `accuracyScore`의 평균.
  Azure 자체 가중치라 덜 뾰족함.
- **단어평균**(`assessedWordScores`) = 시도한 단어별 점수 평균. Mispronunciation인데
  점수가 안 채워진 건 0점 처리. 엄격함(아이 목소리에 Azure가 오발음을 남발하면
  과하게 낮아짐).
- 둘을 섞어 한쪽 편향을 완화한다.
- **`sqrt(completeness)`** — Azure `accuracyScore`는 생략한 단어를 감점하지 않으므로,
  일부러 건너뛰어도 점수가 유지된다. 실제로 읽은 비율로 눌러주되, 선형으로 곱하면
  ASR 누락까지 과반영되므로 sqrt로 완화 (0.9→×0.95, 0.5→×0.71, 0.3→×0.55).

### "발음이 어려운 단어" 목록은 제공하지 않는다

Azure의 단어 단위 `AccuracyScore`는 유창한 성인 낭독에서도 `cake`, `milk`, 이름 같은
쉬운 단어에 40점 미만을 준다. 어떤 임계값을 써도 오탐이 남아서 "아이가 이 단어를
못 읽었다"고 지목하는 건 신뢰할 수 없다. 발음 품질은 **점수에만** 반영한다.

---

## 10. 응답 형태

```jsonc
{
  "accuracy": 87,                    // 읽기 정확도
  "pronunciationAccuracy": 67,       // 발음 정확도
  "pronunciationComment": "...",     // GPT-4o-mini 학부모용 코멘트
  "endingDrops": ["wags", "barks"],
  "substitutions": [{ "from": "a", "to": "the", "before": "give it" }],
  "wrongWords": ["bowl", "of", ...], // 커버리지 계산용 전체 목록 (클라이언트 WPM용)
  "missedWords": ["bowl", "of"],     // 화면 표시용
  "badPronunciations": [],           // 항상 빈 배열 (하위호환용으로만 유지)
  "durationSec": 34.2,
  "leadingSilenceSec": 1.1,
  "recognizedText": "..."
}
```

`endingDrops` / `substitutions`는 현재 **리딩테스트 결과 화면에만** 표시되고
`reading_results` 테이블·`/report`·`/premium-report`에는 반영되지 않는다 (DB 컬럼 추가 필요).

---

## 11. 구조적 한계 (Azure STT 자체, 로직으로 해결 불가)

1. **관사 스왑 `the ↔ a`** — ASR이 약한 관사를 원문 쪽으로 정규화. 전사에 차이가
   안 생겨서 안 보임. (ASR이 우연히 다르게 전사한 경우만 잡힘)
2. **기능어 스킵** (`its`, `of`, `the`) — ASR이 언어모델로 채워넣음.
3. **삽입어** — ASR이 원문에 없는 단어를 버림.
4. **어미 누락** — 음소 점수 편차로 녹음마다 ~4/5만 감지.

이런 오류들은 낮은 음소 점수를 통해 **발음 정확도 점수**에는 간접적으로 반영된다.

---

## 12. 임계값 표 (튜닝용)

`route.ts` 안에 흩어져 있는 상수들:

| 위치 | 값 | 의미 |
|---|---|---|
| `Speech_SegmentationSilenceTimeoutMs` | `1500` | 구간 종료 무음 (아이 뜸들이기 허용) |
| `azureGoodRefIdx` 임계값 | `score >= 72` | 치환 판정에서 "확실히 잘 읽음" 기준 |
| `azureWords` 매칭 창 | `ri + 10` | 원문↔Azure 단어 매칭 look-ahead |
| `uniqueMissed` 최소 길이 | `>= 2` | 1글자 단어 노이즈 제외 |
| 치환 `tooSimilar` | `editDist <= 1` | 사소한 슬립 제외 |
| 치환 `shortNoise` | `from<=2 && to>=5` | 짧은→긴 단어 노이즈 |
| 어미 `relDrop` | `stemMean>=45, last<55, last<=stemMean-20, 총점<78` | 상대 하락 |
| 어미 `hardZero` | `stemMean>=60, last<12` | 끝 음소 ≈0 |
| 어미 `mushyEnding` | `총점<45, last<40, last<=최저음소` | 어간까지 약함 |
| 각 목록 최대 개수 | `6` (화면 표시 `5`) | |

> 이 값들은 개발자(성인) 목소리·마이크로 ~10회 테스트해 잡은 것이라 실제 아이들
> 편차에는 다시 봐야 할 수 있다. 방향은 보수적으로: 놓친 단어·발음 목록은 오탐보다
> 미검출 쪽, 어미·치환은 검출 쪽.

---

## 관련 문서

- 개발 이력: 세션 메모리 `pronun_word_list_rework.md`
- AR 레벨 계산: `docs/ar-level-redesign-2026-08-09.md`
