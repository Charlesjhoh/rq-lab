"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";

function getFinalDiagnosis(data: any) {
  const wrong = data?.wrong_words ?? [];
  const bad = data?.bad_pronunciations ?? [];
  const accuracy = data?.accuracy ?? 100;

  // 우선순위: 읽기 오류 > 발음 > 정확도
  if (wrong.length > 5) {
    return "단어를 빠뜨리거나 잘못 읽는 경향이 있습니다.";
  }

  if (bad.length > 3) {
    return "발음 정확도가 부족합니다.";
  }

  if (accuracy < 80) {
    return "읽기 정확도가 전반적으로 낮은 상태입니다.";
  }

  return "큰 오류 없이 안정적인 읽기입니다.";
}

function ClientPart() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const resultId = searchParams.get("result_id");


  const getRecommendations = (books: any[], user: any) => {
  const levelBooks = books.filter(
    (b) =>
      b.ar_min <= user.ar + 0.3 &&
      b.ar_max >= user.ar - 0.3
  );

  if (levelBooks.length === 0) {
    return { short: [], long: [] };
  }

  const targetWords = user.wpm * 15;

  const sorted = [...levelBooks].sort(
    (a, b) =>
      Math.abs(a.word_count - targetWords) -
      Math.abs(b.word_count - targetWords)
  );

  // ✅ 적당한 책 (가장 가까운 것)
  const short = levelBooks
  .filter(b => b.word_count <= targetWords)
  .sort((a, b) => b.word_count - a.word_count)
  .slice(0, 3);

  const long = levelBooks
    .filter(b => b.word_count > targetWords)
    .sort((a, b) => a.word_count - b.word_count)
    .slice(0, 3);


  return { short, long };
};

function getRecommendationReason(book: any, user: any) {
  const targetWords = user.wpm * 15;

  if (book.word_count <= targetWords * 0.7) {
    return "부담 없이 반복 읽기에 적합";
  }

  if (book.word_count <= targetWords) {
    return "현재 속도에 맞는 적절한 분량";
  }

  return "조금 더 긴 글로 독해력 확장용";
};

useEffect(() => {
  const loadData = async () => {
    // 🔥 1. 책 가져오기
    const { data: booksData } = await supabase
      .from("books")
      .select("*");

    if (booksData) setBooks(booksData);

    // 🔥 2. 각 리딩 결과 가져오기
      const { data } = await supabase
        .from("reading_results")
        .select("*")
        .eq("id", resultId)
        .single();

      if (data) {
      setResult(data); // 🔥 여기만 바뀜
      }

  };

  if (resultId) loadData();
  }, [resultId]);

const rec =
  result && books.length > 0
    ? getRecommendations(books, {
        ar: result.final_ar,
        wpm: result.wpm,
       // comprehension: result.ai_score,
      })
    : { short: [], long: [] };

function getDiagnosis(latest: any) {
  if (!latest) return "";

      const wpm = latest.wpm ?? 0;
      const accuracy = latest.accuracy ?? 0;
      const comprehension = latest.comprehension ?? 0;

  // 🔥 1️⃣ 이해도 낮음
  if (comprehension < 60) {
    return "내용 이해가 부족한 상태입니다. 문장을 정확히 이해하며 읽는 훈련이 필요합니다.";
  }

  // 🔥 2️⃣ 속도만 빠름
  if (wpm > 150 && comprehension < 75) {
    return "읽기 속도는 빠르지만 이해도가 부족합니다. 속도를 줄이고 의미 파악에 집중해야 합니다.";
  }

  // 🔥 3️⃣ 정확도 낮음
  if (accuracy < 85) {
    return "단어 인식 정확도가 부족합니다. 정확하게 읽는 연습이 필요합니다.";
  }

  // 🔥 4️⃣ 안정 구간
  return "현재 수준에서 안정적인 읽기 능력을 보이고 있습니다. 반복 읽기를 통해 실력을 유지하세요.";
}

function getCoreDiagnosis(data: any) {
    if (!data) return "";

      const wpm = data.wpm ?? 0;
      const accuracy = data.accuracy ?? 0;
      const ai_score = data.ai_score ?? 0;
  if (ai_score < 60) {
    return "내용 이해가 부족한 상태입니다.";
  }

  if (wpm > 140 && ai_score < 75) {
    return "읽기 속도는 빠르지만 이해도가 부족합니다.";
  }

  if (accuracy < 85) {
    return "단어를 정확히 읽는 힘이 부족합니다.";
  }

  return "전반적으로 안정적인 읽기입니다.";
}

function getErrorType(data: any) {
  const badPronunciations = data?.bad_pronunciations ?? [];
  const wrongWords = data?.wrong_words ?? [];

  if (badPronunciations.length > wrongWords.length) {
    return "발음 정확도가 주요 문제입니다.";
  }

  if (wrongWords.length > 10) {
    return "단어를 빠뜨리거나 잘못 읽는 경향이 있습니다.";
  }

  return "큰 오류 없이 안정적인 읽기입니다.";
}

function getWordSamples(data: any) {
  const bad = data?.bad_pronunciations ?? [];
  const wrong = data?.wrong_words ?? [];

  return {
    pronunciation: bad.slice(0, 3),
    missing: wrong.slice(0, 3),
  };
}

function getSolution(data: any) {
  if (!data) return "";

      const wpm = data.wpm ?? 0;
      const accuracy = data.accuracy ?? 0;
      const ai_score = data.ai_score ?? 0;
  if (ai_score < 60) {
    return "문장을 의미 단위로 끊어 이해하며 읽는 연습이 필요합니다.";
  }

  if (wpm > 140 && ai_score < 75) {
    return "속도를 줄이고 내용을 이해하며 읽는 훈련이 필요합니다.";
  }

  if (accuracy < 85) {
    return "천천히 정확하게 읽는 반복 훈련이 필요합니다.";
  }

  return "현재 방식으로 꾸준히 읽기 훈련을 유지하세요.";
}

function getReadingTime(book: any, user: any) {
  let factor = 1.0;

  if (book.word_count < 1000) factor = 1.0;
  else if (book.word_count < 3000) factor = 0.9;
  else if (book.word_count < 7000) factor = 0.8;
  else factor = 0.7;

  const effectiveWPM = user.wpm * factor;
  const minutes = book.word_count / effectiveWPM;

  return Math.round(minutes);
}

function getReadingDays(book: any, user: any, dailyMinutes = 20) {
  const minutes = getReadingTime(book, user);
  const days = minutes / dailyMinutes;

  return Math.max(1, Math.ceil(days));
}

function getReadingPlan(book: any, user: any) {
  const minutes = getReadingTime(book, user);

  // 🔥 짧은 책
  if (minutes <= 10) {
    return "👉 하루 20분 동안 2~3회 반복 읽기";
  }

  if (minutes <= 20) {
    return "👉 하루 20분 동안 1~2회 반복 읽기";
  }

  // 🔥 중간 책
  if (minutes <= 40) {
    return "👉 하루 20분씩 읽어 2일 완독";
  }

  if (minutes <= 60) {
    return "👉 하루 20분씩 읽어 3일 완독";
  }

  // 🔥 긴 책
  if (minutes <= 90) {
    return "👉 하루 20분씩 나누어 읽기 (약 1주 완독)";
  }
  else{
  return "👉 하루 20분씩 꾸준히 읽는 장기 독해 훈련";
  }
}

function getPremiumSummary(data: any) {
  const wrong = data?.wrong_words ?? [];
  const bad = data?.bad_pronunciations ?? [];

  let problem = "";
  let cause = "";
  let solution = "";

  if (wrong.length > 5) {
    problem = "단어를 빠뜨리거나 잘못 읽는 경향이 있습니다.";
    cause = "빠르게 읽으면서 단어를 정확히 보지 못하고 있습니다.";
    solution = "속도를 줄이고 한 문장을 2~3번 반복해서 읽는 훈련이 필요합니다.";
  } else if (bad.length > 3) {
    problem = "발음 정확도가 부족합니다.";
    cause = "소리를 정확히 구분하지 못하고 읽고 있습니다.";
    solution = "틀린 단어를 따로 모아서 소리 중심으로 반복 훈련이 필요합니다.";
  } else {
    problem = "큰 오류 없이 안정적인 읽기입니다.";
    cause = "기본적인 읽기 습관이 잘 형성되어 있습니다.";
    solution = "속도를 조금씩 올리는 훈련을 하면 더 좋아집니다.";
  }

  return { problem, cause, solution };
}
//const summary = getPremiumSummary(data);
//const diagnosis = getCoreDiagnosis(result);
const errorType = getErrorType(result);
const samples = getWordSamples(result);
const solution = getSolution(result);
const diagnosis = getFinalDiagnosis(data);

if (!result) return <div>결과가 없습니다</div>;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h2>💎 프리미엄 리포트</h2>
      <div>
        <h3>📊 학습 진단</h3>
        <p>{diagnosis}</p>


        <h4>🔍 대표 오류 단어</h4>
        <p>발음 오류: {samples.pronunciation.join(", ")}</p>
        <p>읽기 오류: {samples.missing.join(", ")}</p>

        <h4>🚀 학습 전략</h4>
        <p>{solution}</p>
      </div>
      {result && (
        
         <div style={{ marginBottom: 20 }}>
          <h3>📊 현재 수준</h3>
          
            <p>📘 AR: {result.final_ar ? result.final_ar.toFixed(1) : "-"}</p>
            <p>⚡ 속도: {result.wpm ? Math.round(result.wpm) : "-" } WPM</p>
            <p>🎯 정확도: {result.accuracy ? Math.round(result.accuracy) : "-" }%</p>
            <p>📚 이해도: {result.comprehension ? Math.round(result.comprehension) : "-" }%</p>
            {result && (
              <div style={{ marginTop: 10, background: "#f5f5f5", padding: 12 }}>
                <b>📊 학습 진단</b>
                <p>{getDiagnosis(result)}</p>
              </div>
            )}
         </div>
       )}
          {/* 📚 추천 도서 */}
          <div style={{ marginTop: 30 }}>
            <h3>📚 추천 도서</h3>

            {/* 짧은 책 */}
            {rec.short.map((b, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <p style={{ fontWeight: 600 }}>
                  {i + 1}. {b.title}
                  <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>
                    📊 {b.word_count} words | ⏱ {getReadingTime(b, result)}분
                  </span>
                </p>

                <p style={{ marginLeft: 12, fontSize: 13, color: "#555" }}>
                  → {getReadingPlan(b, result)} | {getRecommendationReason(b, result)}
                </p>
              </div>
            ))}

            {/* 긴 책 */}
            {rec.long.length > 0 && (
              <>
                <p style={{ marginTop: 10 }}>
                  <b>🚀 도전 읽기 (긴 책)</b>
                </p>

                {rec.long.map((b, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <p style={{ fontWeight: 600 }}>
                      {i + 1}. {b.title}
                      <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>
                        📊 {b.word_count} words | ⏱ {getReadingTime(b, result)}분
                      </span>
                    </p>

                    <p style={{ marginLeft: 12, fontSize: 13, color: "#555" }}>
                      → {getReadingPlan(b, result)} | {getRecommendationReason(b, result)}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* 👉 여기 밖으로 빼야 함 */}
          <p>더 자세한 분석을 확인하려면 상담이 필요합니다.</p>

          <div style={{ marginTop: 30 }}>
            <button
              onClick={() => {
                window.open("https://open.kakao.com/o/gIcwAHli");
              }}
            >
              📞 1:1 상담 신청하기
            </button>
          </div>
        </div>
  );
}

export default function PremiumReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientPart />
    </Suspense>
  );
}