# 결제 시스템 정리 (2026-08-13, 2026-08-17 포트원+토스페이먼츠 전환)

## 개요

이 앱의 결제는 서로 완전히 독립된 두 축으로 나뉜다.

| 축 | 결제 주체 | 결제 방식 | 사는 것 |
|---|---|---|---|
| 개인 결제 | 학부모/학생 본인 | 포트원(PortOne) `requestPayment` (1회성 카드 결제) | 프리미엄 리포트 1건 열람 또는 월 2회 패키지 |
| 선생님 좌석 구독 | 선생님 | 포트원 빌링키 + 예약결제(직접 관리하는 정기 청구) | 반 학생 정원(좌석) |

**2026-08-17 결제대행사 전환**: 원래 Stripe로 구축돼 있었으나, 한국이 Stripe 직접 지원국이 아니라(지원국의
실제 사업체가 있어야만 계정 개설 가능) 국내 PG인 **포트원(PortOne) + 토스페이먼츠**로 전환했다. Stripe는
Checkout(호스팅 결제 페이지)과 Billing Portal(호스팅 구독관리 페이지), 자동 프로레이션을 대신 해줬지만,
포트원+토스에는 그런 호스팅 페이지가 없어서 카드 등록 UI, 정기 청구 스케줄링, 구독 해지, 프로레이션 계산을
전부 이 레포가 직접 구현한다.

둘은 DB 테이블도, 결제 방식(단건 vs 빌링키+예약결제)도, 웹훅 이벤트도 서로 다르다. 아래에서 각각 정리한다.

---

## 1. 개인 결제 (프리미엄 리포트 / 패키지)

### 1-1. 상품 정의

[`src/lib/products.ts`](../src/lib/products.ts)에 하드코딩:

| product_type | 가격 | 내용 |
|---|---|---|
| `single_report` | ₩19,000 | 지정한 리포트 1건 열람 잠금 해제 |
| `package_2x_month` | ₩35,000 | 크레딧 2개 지급, 30일 후 만료 |

가격은 항상 서버(`PRODUCT_PRICES`)가 정하고, 클라이언트가 보낸 금액은 신뢰하지 않는다.

### 1-2. 결제 흐름

```
[premium-report 페이지]
  "리포트 잠금 해제" 클릭
       │
       ▼
[/checkout?type=single|package&resultId=...]
       │  (로그인 세션 필요)
       ▼
POST /api/payments/create-intent
  - resultId가 본인(auth.uid) 소유인지 확인
  - 쿠폰 있으면 할인 계산
  - orders 테이블에 pending 행 생성/갱신
  - 100% 할인이면 → status=completed로 즉시 종료 (결제 호출 없음, "freePass")
  - 그 외 → 금액/주문 정보만 반환(포트원은 Stripe PaymentIntent 같은 사전 생성 세션이 필요 없음)
       │
       ▼
[클라이언트가 PortOne.requestPayment() 직접 호출 — payment-{orderId}-{uuid} paymentId 생성] (freePass면 스킵)
       │
       ▼
/checkout/success  (paymentId, orderId를 쿼리스트링으로 전달)
  - freePass든 실제 결제든, 도착하면 POST /api/payments/confirm 호출
  - 이 주문이 본인(auth.uid) 소유인지 확인
  - freePass가 아니면 PaymentClient.getPayment(paymentId)로 status=PAID && 금액 일치까지 서버가
    직접 검증(클라이언트가 보낸 성공 응답을 그대로 믿지 않음) → orders.portone_payment_id 저장
  - grantEntitlementForOrder() 실행
       │
       ▼
grantEntitlementForOrder(orderId)  [src/lib/payments.ts]
  - orders.status를 pending → paid로 원자적으로 전환 (이미 paid면 즉시 종료 = 멱등)
  - coupon_id가 있으면 redeem_coupon() 호출(1-4 참고)
  - product_type에 따라:
    · single_report → reading_results.is_unlocked = true
    · package_2x_month → credit_packages에 새 행(총 2크레딧, 30일 만료) insert
```

**같은 결과가 두 경로로 들어올 수 있다** — 클라이언트가 `/checkout/success`에서 부르는 `confirm`과, 포트원이
`Transaction.Paid` 웹훅으로 부르는 `grantEntitlementForOrder`가 같은 주문을 놓고 경쟁할 수 있음.
`orders.status`를 `neq('paid')` 조건으로 원자적으로 전환해서, 먼저 도착하는 쪽만 실제로 지급하고 나머지는
조용히 스킵하도록 만들어져 있다(멱등 처리).

### 1-3. 크레딧 소진 (패키지 구매자가 리포트 열 때)

패키지를 사면 크레딧이 쌓이고, 이후 새로 나오는 리포트(reading_results)를 볼 때마다 자동으로 1개씩 깎는다.

- 트리거 지점 1: [StepTestClient.tsx](../src/app/reading-test/StepTestClient.tsx)에서 테스트 채점이 끝나 결과가 insert되는 즉시 `/api/credits/consume` 자동 호출 (조용히 실패해도 무시 — 최종 관문 아님)
- 트리거 지점 2: [premium-report 페이지](../src/app/premium-report/page.tsx)에서 잠긴 리포트를 열 때도 동일 API 호출

`POST /api/credits/consume`:
1. 본인 소유 리포트인지 확인, 이미 unlocked면 종료
2. 만료 안 된 크레딧 패키지 중 가장 먼저 만료되는 것 1개 선택
3. **읽은 remaining_credits 값 그대로를 WHERE 조건에 걸어 compare-and-swap 방식으로 차감** (2026-08-12 수정 — 예전에는 `> 0`만 확인해서 동시 요청 시 크레딧 1개로 리포트 2개가 풀릴 수 있었음)
4. reading_results.is_unlocked = true 갱신, 그 사이 다른 경로로 이미 풀렸으면 방금 깎은 크레딧 환불

### 1-4. 쿠폰

`coupons` 테이블(레포 마이그레이션 밖에서 직접 생성됨)에서 코드로 조회 → `is_active`, `expires_at`, `max_uses` 확인하고 할인 적용. `discount_type`은 `percent`/`amount` 두 종류.

**✅ `max_uses` 강제 (2026-08-14 대응):** [`0008_coupon_usage_limits.sql`](../supabase/migrations/0008_coupon_usage_limits.sql)에서 `coupons.max_uses`/`used_count` 컬럼과, 체크-후-증가를 단일 `UPDATE`로 원자화한 `redeem_coupon()` 함수를 추가했다.
- 실제 방어선은 [`grantEntitlementForOrder`](../src/lib/payments.ts)다 — 주문을 pending/completed→paid로 원자적으로 전환시키는 유일한 관문이라, 여기서 `redeem_coupon()`을 호출해 사용 횟수를 정산한다. 무료(freePass) 주문이 한도 초과로 걸리면 엔타이틀먼트 지급 자체를 거부하고 `orders.status = 'failed'`로 되돌린다. 유료 주문은 결제가 이미 끝난 뒤라 지급은 진행하고 경고 로그만 남긴다(레이스가 나더라도 이미 받은 돈을 취소할 순 없다는 판단).
- `create-intent`는 같은 조건(`used_count < max_uses`)을 사전 체크해서, 한도 다 찬 쿠폰은 만료 쿠폰과 동일하게 조용히 할인 미적용 처리한다(UX용, 실제 방어선 아님).
- `redeem_coupon()`은 `service_role`에만 `EXECUTE` 권한을 부여해 클라이언트가 직접 호출해 쿠폰을 고갈시키지 못하게 막았다.
- 매니저 쿠폰 페이지(`/manager/coupons`)에서 생성/수정 시 `max_uses`를 지정할 수 있고, 목록에 `used_count / max_uses`가 표시된다.

### 1-5. 관련 테이블

- `orders` — 주문 1건당 1행. `product_type`, `result_id`(단건 결제 대상), `status`(pending/paid/completed/refunded/failed), `portone_payment_id`(포트원 결제 아이디, 2026-08-17부터). 과거 `stripe_payment_intent_id`는 마이그레이션 이전 데이터 보존용으로 컬럼만 남아 있음
- `credit_packages` — 패키지 구매(또는 매니저 수동 지급) 1건당 1행. `total_credits`/`remaining_credits`/`expires_at`
- `reading_results.is_unlocked` / `unlock_source` / `unlocked_at` / `unlock_order_id` — 리포트 잠금 상태
- `payment_logs` — 과거 Stripe 웹훅에서 쓰던 정산 로그 테이블(현재는 안 씀)
- `coupons` — 코드/할인율/활성여부/만료일/사용횟수 (레포 마이그레이션 파일 없음, 대시보드에서 직접 관리)

### 1-6. 매니저 수동 지급

`POST /api/manager/credits/grant` (role=manager 전용) — 결제 없이 특정 유저에게 크레딧 패키지를 직접 발급. 체험판/CS 대응용.

**✅ 지급 상한 (2026-08-14 대응):** [`src/lib/products.ts`](../src/lib/products.ts)의 `MANAGER_GRANT_MAX_CREDITS`(20개), `MANAGER_GRANT_MAX_DAYS`(180일)를 초과하는 요청은 거부한다(오타나 계정 오남용으로 큰 값이 잘못 들어가는 걸 막는 안전장치, 필요하면 나눠서 여러 번 지급). 지급 성공 시 `console.log`로 grantedBy/targetUser/credits/days를 구조화된 한 줄 로그로 남긴다. 별도 알림(Slack/이메일) 시스템은 이 레포에 인프라 자체가 없어 이번엔 추가하지 않았다 — 로그 기반 모니터링이 필요하면 후속 조치.

---

## 2. 선생님 좌석 구독

### 2-1. 상품 정의

[`src/lib/products.ts`](../src/lib/products.ts)의 `TEACHER_SEAT_PRICE_KRW`(₩15,000/좌석/월)에 하드코딩 —
Stripe Price 객체가 아니라 이 레포가 직접 가격을 관리한다.

### 2-2. 구독 시작 흐름

포트원+토스에는 Stripe Checkout Subscription 같은 "구독 객체"가 없다. 대신 **빌링키(카드를 한 번 등록해두고
나중에 그 빌링키로 반복 청구)** + **예약결제(포트원에 특정 시각에 자동 청구되도록 예약)** 조합으로 직접
구독 상태 머신을 관리한다.

```
[teacher/classes 페이지] 좌석 수 입력 후 "좌석 구매하기" 클릭
       │
       ▼
[클라이언트] PortOne.requestIssueBillingKey() — 카드 등록 창 호출, customer.customerId=teacherId
  (토스 신모듈은 customerId를 명시해야 나중에 매핑 가능)
       │  billingKey 발급됨
       ▼
POST /api/subscriptions/checkout  (role=teacher, body: { seatCount, billingKey })
  - 이미 active/trialing/past_due 구독 있으면 거부(좌석 변경 API를 쓰라고 안내)
  - 첫 달 요금(seatCount × TEACHER_SEAT_PRICE_KRW)을 그 빌링키로 즉시 청구
    (POST /payments/{id}/billing-key) — 실패하면 아무것도 저장하지 않고 에러 반환
  - 성공하면 teacher_subscriptions upsert: portone_billing_key, seat_count,
    status='active', current_period_end=now+30일
  - 다음 달 청구를 위한 예약결제 생성(POST /payments/{id}/schedule, timeToPay=current_period_end),
    반환된 스케줄 id를 next_schedule_id에 저장
```

이후 예약된 시점에 포트원이 자체적으로 그 빌링키로 청구를 실행하고, 그 결과가 `Transaction.Paid`(성공) 또는
`Transaction.Failed`(실패) 웹훅으로 들어온다(2-3 참고). Stripe와 달리 자동 반복이 없어서, 정기 청구가 성공할
때마다 **다음 1건을 웹훅 핸들러가 직접 다시 예약**해야 체인이 끊기지 않는다.

구독을 해지하면(2-4 참고) `status=canceled`로 갱신(기존 학생의 `class_id`는 건드리지 않음 — 강제 탈퇴는
스코프 밖. 대신 mypage에 사전 고지 배너가 뜬다 — 2-6 참고).

### 2-3. 좌석 수 변경 / 정기 청구 / 웹훅

- **`POST /api/subscriptions/update-seats`** — 현재 소속 학생 수보다 적게는 줄일 수 없도록 서버에서 막음.
  - **늘릴 때(사용자가 명시적으로 확인한 정책)**: 이번 결제 주기의 남은 기간만큼 차액을 일할계산해서
    빌링키로 **즉시 청구**하고, 성공해야만 `seat_count`를 갱신한다(Stripe가 하던 프로레이션과 동일한 정책을
    직접 구현). 실패하면 좌석 수는 그대로 두고 에러 반환.
  - **줄일 때**: 즉시 환불 없이 `seat_count`만 갱신 — 다음 결제일부터 적은 금액이 반영된다(이번 주기 남은
    기간은 이미 낸 돈 그대로 사용).
  - 어느 쪽이든 기존 `next_schedule_id` 예약을 취소하고 새 좌석 수 기준 금액으로 다음 예약을 다시 만든다.
- **웹훅 `POST /api/webhooks/portone`** (`Transaction.Paid`, 빌링키가 있는 결제 = 정기 청구):
  `teacher_subscriptions.portone_billing_key`로 매칭 → `current_period_end`를 30일 뒤로 갱신하고 다음
  예약결제를 새로 생성. `last_charged_payment_id`로 같은 결제를 두 번 처리하지 않도록 멱등 처리(첫 결제는
  `subscriptions/checkout`에서 이미 동기 처리되지만 같은 웹훅이 뒤이어 들어올 수 있음).
- **웹훅 `Transaction.Failed`** (빌링키 결제): `status='past_due'`로 변경. 자동 재시도는 없음(최소 구현,
  후속 조치로 문서화 — 4번 참고).
- **`POST /api/subscriptions/cancel`** — 예약된 다음 청구를 취소(`DELETE /payment-schedules`)하고
  빌링키를 삭제(`DELETE /billing-keys/{key}`) 후 `status='canceled'`. **카드 변경은 "해지 후 재등록"으로
  단순화**했다(전용 카드교체 플로우는 스코프 밖).

### 2-4. 학생이 반에 들어오는 흐름 (좌석 소비)

```
[학생] 참여코드 입력 (mypage/JoinClassForm)
       │
       ▼
POST /api/classes/join  (role=student)
  1. 이미 다른 반 소속이면 거부
  2. join_code로 반/선생님 조회
  3. 선생님 구독이 active/trialing인지 확인
  4. (참고용) 현재 인원 수 < seat_count 인지 사전 확인
  5. profiles.class_id = 해당 반으로 UPDATE
       │
       ▼
DB 트리거 enforce_class_seat_limit (2026-08-13 추가, 최종 관문)
  - teacher_subscriptions 행을 FOR UPDATE로 잠가 같은 선생님 앞 동시 가입을 직렬화
  - 잠금 상태에서 다시 인원 수를 세고 seat_count 초과면 UPDATE 자체를 거부
```

4번(API 레벨 사전 확인)만 있던 시절엔 "확인"과 "쓰기"가 원자적이지 않아, 여러 학생이 거의 동시에 같은 참여코드로 들어오면(신학기 단체 가입 등) 결제한 좌석 수보다 많이 들어갈 수 있었다. 지금은 5번 트리거가 실제 정원 초과를 막는 최종 관문이고, 4번은 그냥 사용자에게 빠르고 친절한 에러 메시지를 주기 위한 사전 확인일 뿐이다.

### 2-5. 관련 테이블

- `teacher_subscriptions` — 선생님 1명당 1행(`teacher_id` unique). `seat_count`, `status`,
  `current_period_end`, `portone_billing_key`, `next_schedule_id`(예약된 다음 청구 id),
  `last_charged_payment_id`(정기 청구 웹훅 중복 처리 방지용). 과거 `stripe_customer_id`/
  `stripe_subscription_id` 컬럼은 마이그레이션 이전 데이터 보존용으로 남아 있음
- `classes` — 반. `join_code`(6자리)로 학생이 검색해서 참여
- `profiles.class_id` — 학생이 소속된 반. 이 값이 있으면 [`checkTestEligibility`](../src/lib/test-eligibility.ts)가 리딩테스트 응시 가능 여부를 "선생님 구독 상태"에 연동해서 판정한다(구독 끊기면 그 반 학생도 테스트 응시 불가 — 기존에 이미 가입된 class_id가 남아있다고 계속 무료로 못 쓰게 하기 위함). 이 구독 상태 조회 로직은 `isTeacherSubscriptionInactive(classId)`로 분리되어 있어, `checkTestEligibility`(테스트 시도 시점 반응적 체크)뿐 아니라 [`/mypage`](../src/app/mypage/page.tsx)(로그인 직후 사전 고지 배너)에서도 재사용한다.

### 2-6. 좌석 사용량 조회

- `GET /api/teacher/classes` — 선생님 본인의 반 목록 + 구독 상태
- `GET /api/teacher/credits?userId=` — 특정 학생의 남은 프리미엄 크레딧 조회(선생님은 자기 반 학생만, 매니저는 전체)

---

## 3. 공통 인프라

- **포트원 웹훅**: `POST /api/webhooks/portone` 하나가 개인 결제(`Transaction.Paid`, `Transaction.Cancelled`, `Transaction.PartialCancelled`)와 선생님 구독 정기 청구(`Transaction.Paid`/`Transaction.Failed`, 빌링키 유무로 구분) 이벤트를 전부 처리한다. Standard Webhooks 방식 서명 검증(`PORTONE_WEBHOOK_SECRET`, [`src/lib/portone.ts`](../src/lib/portone.ts)의 `verifyPortOneWebhook`) 통과한 요청만 신뢰. **포트원 콘솔 "연동 정보 > 결제알림(Webhook) 관리"에서 웹훅 시크릿을 발급해 `.env.local`에 넣어야 실제로 검증이 동작한다.**
  - 결제(`Transaction.Paid`)가 빌링키 결제인지(정기 구독) 아닌지(개인 단건결제)는 `payment.billingKey` 유무로 구분한다 — paymentId 접두사 파싱 대신 이 방법을 쓴 이유는 더 견고해서다.
- **가격은 항상 서버가 확정**: 두 축 모두 클라이언트가 금액을 보내지 않는다(개인 결제는 `PRODUCT_PRICES`, 좌석 구독은 `TEACHER_SEAT_PRICE_KRW` 참조).
- **본인 인증**: 두 축 모두 결제/구독 관련 API는 `requireUser`/`requireRole`로 Supabase 세션을 검증하고, 대상 리소스(resultId/orderId/class)가 실제로 그 유저 소유인지 재확인한다.
- **결제 검증은 클라이언트를 믿지 않는다**: `/api/payments/confirm`은 클라이언트가 보낸 "결제 성공" 신호를 그대로 믿지 않고, 서버가 직접 `PaymentClient.getPayment(paymentId)`로 상태(`PAID`)와 금액 일치까지 재확인한 뒤에만 엔타이틀먼트를 지급한다.
- **환불 시 DB 롤백**: `Transaction.Cancelled` 웹훅에서 `orders.portone_payment_id`로 주문을 찾아, 주문이 `paid` 상태일 때만 자동 회수한다(`handleTransactionCancelled`, [webhooks/portone/route.ts](../src/app/api/webhooks/portone/route.ts)):
  - `single_report` → `reading_results.is_unlocked = false` (단, `unlock_order_id`가 그 주문과 일치할 때만 — 다른 경로로 이미 풀린 리포트를 잘못 잠그지 않도록)
  - `package_2x_month` → 해당 주문으로 지급된 `credit_packages.remaining_credits = 0` (이미 소비해서 열린 리포트까지 소급 회수하진 않음 — 이미 제공된 콘텐츠 강제 회수는 스코프 밖)
  - `orders.status = 'refunded'`
  - 부분 취소(`Transaction.PartialCancelled`)는 재량 환불일 수 있어 자동 회수하지 않고 로그만 남긴다.

## 4. 알려진 제약 / 후속 조치 필요

- **정기 청구 실패(dunning) 처리가 최소 구현** — `Transaction.Failed`로 `status='past_due'`만 남기고 자동 재시도는 없음. 선생님이 인지 후 재구독하는 흐름에 의존
- **카드 변경 전용 플로우 없음** — "해지 후 재등록"으로 단순화(2-3 참고)
- **환불 부분 케이스 미자동화** — 부분 취소, 디스퓨트는 여전히 수동 대응 필요
- **매니저 수동 크레딧 지급 알림 없음** (1-6 참고) — 상한과 로그는 있지만 실시간 알림 인프라는 없음
- **좌석 구독 해지 시 반 소속 자체는 안 풀림** (2-2 참고) — `class_id`가 그대로 남아있는 건 의도된 스코프 밖 결정
