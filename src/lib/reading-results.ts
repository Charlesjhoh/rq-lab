// "좌절(frustration)" 판정이 난 결과는 지문이 그 학생에게 안 맞았다는 신호일 뿐,
// 실력을 보여주는 데이터가 아니다. 최신/오늘/이번 주 결과처럼 "이 학생의 현재 상태"를
// 대표하는 단일 결과를 뽑을 땐 이런 레벨 불일치 결과를 건너뛰고, 가장 최근의 신뢰할 만한
// 결과를 대신 보여준다. 신뢰할 만한 결과가 하나도 없으면(모두 frustration) 그래도 뭔가는
// 보여줘야 하므로 진짜 최신 결과로 대체한다.
export function pickReliableLatest<T extends { reading_level?: string | null }>(
  results: T[]
): T | undefined {
  return results.find((r) => r.reading_level !== "frustration") ?? results[0];
}
