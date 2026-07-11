"use client";
import { createReadingCoachResult } from "@/lib/reading-coach-engine";
import PremiumScoreCard from "@/components/ui/PremiumScoreCard";
import { generateReadingCoach } from "@/lib/reading-coach-engine";
import ScoreCard from "@/components/ui/ScoreCard";
import { Roadmaps } from "@/lib/roadmap-templates";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";

function getFinalDiagnosis(data: any) {
  const wrong = data?.wrong_words ?? [];
  const bad = data?.bad_pronunciations ?? [];
  const accuracy = data?.accuracy ?? 100;

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
      (b) => b.ar_min <= user.ar + 0.3 && b.ar_max >= user.ar - 0.3
    );

    if (levelBooks.length === 0) {
      return { short: [], long: [] };
    }

    const targetWords = user.wpm * 15;

    const short = levelBooks
      .filter((b) => b.word_count <= targetWords)
      .sort((a, b) => b.word_count - a.word_count)
      .slice(0, 3);

    const long = levelBooks
      .filter((b) => b.word_count > targetWords)
      .sort((a, b) => a.word_count - b.word_count)
      .slice(0, 3);

    return { short, long };
  };

  function getRecommendationReason(book: any, user: any) {
    const readingTime = getReadingTime(book, user);
    const reasons: string[] = [];

    if (readingTime <= 20) {
      reasons.push(
        `현재 읽기 속도라면 약 ${readingTime}분 안에 완독할 수 있는 부담 없는 분량입니다.`
      );
    } else if (readingTime <= 40) {
      reasons.push(
        `하루 20분씩 읽으면 약 2일 안에 완독할 수 있는 적절한 길이입니다.`
      );
    } else {
      reasons.push(
        `조금 더 긴 책으로 읽기 지구력을 키우기에 적합합니다.`
      );
    }

    if (user.comprehension < 80) {
      reasons.push(
        "내용을 이해하며 읽는 연습을 하기 좋은 난이도입니다."
      );
    } else {
      reasons.push(
        "현재 수준에서 자연스럽게 다음 단계로 확장할 수 있는 책입니다."
      );
    }

    if (user.accuracy < 90) {
      reasons.push(
        "반복 읽기를 통해 정확도를 높이기에 적합한 분량입니다."
      );
    } else if (user.wpm < 100) {
      reasons.push(
        "속도를 조금씩 높이는 연습용으로 추천합니다."
      );
    } else {
      reasons.push(
        "읽기 유창성을 유지하면서 독서량을 늘리기에 적합합니다."
      );
    }

    return reasons;
  }

  useEffect(() => {
    const loadData = async () => {
      const { data: booksData } = await supabase.from("books").select("*");
      if (booksData) setBooks(booksData);

      const { data } = await supabase
        .from("reading_results")
        .select("*")
        .eq("id", resultId)
        .single();

      if (data) {
        setResult(data);
      }
    };

    if (resultId) loadData();
  }, [resultId]);

  const rec =
    result && books.length > 0
      ? getRecommendations(books, {
          ar: result.final_ar,
          wpm: result.wpm,
        })
      : { short: [], long: [] };

  function getDiagnosis(latest: any) {
    if (!latest) return "";

    const wpm = latest.wpm ?? 0;
    const accuracy = latest.accuracy ?? 0;
    const comprehension = latest.comprehension ?? 0;

    if (comprehension < 60) {
      return "내용 이해가 부족한 상태입니다. 문장을 정확히 이해하며 읽는 훈련이 필요합니다.";
    }
    if (wpm > 150 && comprehension < 75) {
      return "읽기 속도는 빠르지만 이해도가 부족합니다. 속도를 줄이고 의미 파악에 집중해야 합니다.";
    }
    if (accuracy < 85) {
      return "단어 인식 정확도가 부족합니다. 정확하게 읽는 연습이 필요합니다.";
    }
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

    if (minutes <= 10) {
      return "👉 하루 20분 동안 2~3회 반복 읽기";
    }
    if (minutes <= 20) {
      return "👉 하루 20분 동안 1~2회 반복 읽기";
    }
    if (minutes <= 40) {
      return "👉 하루 20분씩 읽어 2일 완독";
    }
    if (minutes <= 60) {
      return "👉 하루 20분씩 읽어 3일 완독";
    }
    if (minutes <= 90) {
      return "👉 하루 20분씩 나누어 읽기 (약 1주 완독)";
    } else {
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

  if (!result) return <div>결과가 없습니다</div>;

  const coach = generateReadingCoach({
    ar: result.final_ar,
    wpm: result.wpm,
    accuracy: result.accuracy,
    comprehension: result.comprehension,
  });

  const samples = getWordSamples(result);

  return (
    
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      
{/* Premium Dashboard 구역 - 강제 인라인 2x2 바둑판 격자 스타일 */}
<div style={{ marginTop: "40px", width: "100%" }}>
  <div style={{ marginBottom: "24px" }}>
    <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#0F172A", margin: 0 }}>
      ✨ AI Premium Reading Dashboard
    </h2>
    <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", margin: 0 }}>
      AI analyzed your child's reading performance.
    </p>
  </div>

  {/* 💡 Tailwind 설정 무관하게 무조건 브라우저단에서 2x2 격자 배열을 강제함 */}
  <div 
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "16px",
      width: "100%",
      boxSizing: "border-box"
    }}
  >
    <PremiumScoreCard title="AR Level" value={result.final_ar ?? 0} max={5} unit="" variant="ar" />
    <PremiumScoreCard title="Reading Speed" value={Math.round(result.wpm ?? 0)} max={180} unit="WPM" />
    <PremiumScoreCard title="Accuracy" value={Math.round(result.accuracy ?? 0)} max={100} unit="%" />
    <PremiumScoreCard title="Comprehension" value={Math.round(result.comprehension ?? 0)} max={100} unit="%" />
  </div>
</div>
      <h2>🗺️ Reading Roadmap</h2>

      {coach && (
        <div
          style={{
            background: "#F8FAFC",
            padding: 20,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <h3>📍 Current Reading Stage</h3>
          <p>
            <b>{coach.stage}</b>
          </p>

          <h3>🎯 Core Diagnosis</h3>
          <p>{coach.diagnosis}</p>

          <h3>📖 Reading Goal</h3>
          <p>{coach.goal}</p>

          <h3>🗓️ 4-Week Reading Roadmap</h3>
          <ul>
            {coach.roadmap.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>

          <h3>👨‍👩‍👧 Parent Action</h3>
          <ul>
            {coach.parentAction.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />


      <div style={{ marginTop: 20 }}>
        <h4>🔍 대표 오류 단어</h4>
        <p>발음 오류: {samples.pronunciation.join(", ")}</p>
        <p>읽기 오류: {samples.missing.join(", ")}</p>
      </div>

      {/* 📚 추천 도서 */}
      <div style={{ marginTop: 30 }}>
        <h3>📚 추천 도서</h3>

        {/* 짧은 책 */}
        {rec.short.map((b, i) => (
          <div
            key={i}
            style={{
              background: "#F8FAFC",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <h4 style={{ margin: 0 }}>
              📘 {i + 1}. {b.title}
            </h4>

            <p style={{ margin: "8px 0", color: "#666", fontSize: 13 }}>
              📊 {b.word_count.toLocaleString()} words
              &nbsp;&nbsp;|&nbsp;&nbsp;
              ⏱ 예상 {getReadingTime(b, result)}분
            </p>

            <div style={{ marginTop: 10 }}>
              <b>추천 이유</b>
              <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                {getRecommendationReason(b, result).map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            <p
              style={{
                marginTop: 10,
                color: "#2563EB",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
               {getReadingPlan(b, result)}
            </p>
          </div>
        ))}

        {/* 긴 책 */}
        {rec.long.length > 0 && (
          <>
            <h3 style={{ marginTop: 30 }}>
              🚀 도전 읽기 (긴 책)
            </h3>

            {rec.long.map((b, i) => (
              <div
                key={i}
                style={{
                  background: "#FFF8E8",
                  border: "1px solid #F5D88A",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <h4 style={{ margin: 0 }}>
                  🚀 {i + 1}. {b.title}
                </h4>

                <p style={{ margin: "8px 0", color: "#666", fontSize: 13 }}>
                  📊 {b.word_count.toLocaleString()} words
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  ⏱ 예상 {getReadingTime(b, result)}분
                </p>

                <div style={{ marginTop: 10 }}>
                  <b>도전 이유</b>
                  <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                    {getRecommendationReason(b, result).map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <p
                  style={{
                    marginTop: 10,
                    color: "#D97706",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                   {getReadingPlan(b, result)}
                </p>
              </div>
            ))}
          </>
        )}
      </div>

      <hr style={{ margin: "30px 0" }} />

      <div style={{ textAlign: "center" }}>
        <p>더 자세한 분석을 확인하려면 상담이 필요합니다.</p>
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