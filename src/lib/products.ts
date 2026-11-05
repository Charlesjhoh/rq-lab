export const PACKAGE_TOTAL_CREDITS = 2;
export const PACKAGE_DURATION_DAYS = 30;

// 매니저 CS/체험판 수동 지급 상한 — 오타나 계정 오남용으로 큰 값이 잘못 들어가는 걸 막는
// 안전장치. 정상 구매(패키지 2크레딧/30일)보다 넉넉하게 잡되 무제한은 아니게 설정.
export const MANAGER_GRANT_MAX_CREDITS = 20;
export const MANAGER_GRANT_MAX_DAYS = 180;

// 선생님 좌석 구독 — 좌석 1개당 월 가격 (포트원+토스페이먼츠, 이 레포가 직접 가격을 관리)
export const TEACHER_SEAT_PRICE_KRW = 15000;
// 좌석 수 상한 — PG 심사에 신고한 1회 최대 청구액(200석 × 15,000원 = 3,000,000원)의 근거
export const TEACHER_SEAT_MAX = 200;
export const TEACHER_SEAT_ORDER_NAME = 'Read English Better 선생님 좌석 구독';

export const PRODUCT_PRICES: Record<string, number> = {
  single_report: 19000,
  package_2x_month: 35000,
};

export const PRODUCT_LABELS: Record<string, string> = {
  single_report: '프리미엄 리포트 1회 열람',
  package_2x_month: '월 2회 패키지',
};

// 상품 페이지에 제공기간을 표시해야 한다(PG 심사 요건).
export const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  single_report: '결제 즉시 리포트 1건을 열람할 수 있습니다.',
  package_2x_month: `결제일로부터 ${PACKAGE_DURATION_DAYS}일간 리포트 ${PACKAGE_TOTAL_CREDITS}회를 열람할 수 있습니다.`,
};
