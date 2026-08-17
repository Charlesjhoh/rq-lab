export const PACKAGE_TOTAL_CREDITS = 2;
export const PACKAGE_DURATION_DAYS = 30;

// 매니저 CS/체험판 수동 지급 상한 — 오타나 계정 오남용으로 큰 값이 잘못 들어가는 걸 막는
// 안전장치. 정상 구매(패키지 2크레딧/30일)보다 넉넉하게 잡되 무제한은 아니게 설정.
export const MANAGER_GRANT_MAX_CREDITS = 20;
export const MANAGER_GRANT_MAX_DAYS = 180;

// 선생님 좌석 구독 — 좌석 1개당 월 가격 (포트원+토스페이먼츠, 이 레포가 직접 가격을 관리)
export const TEACHER_SEAT_PRICE_KRW = 15000;

export const PRODUCT_PRICES: Record<string, number> = {
  single_report: 19000,
  package_2x_month: 35000,
};

export const PRODUCT_LABELS: Record<string, string> = {
  single_report: '프리미엄 리포트 1회 열람',
  package_2x_month: '월 2회 패키지',
};
