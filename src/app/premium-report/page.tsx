"use client";
import PremiumScoreCard from "@/components/ui/PremiumScoreCard";
import { generateReadingCoach } from "@/lib/reading-coach-engine";
import ScoreCard from "@/components/ui/ScoreCard";
import { Roadmaps } from "@/lib/roadmap-templates";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  Sparkles,
  Map,
  MapPin,
  Stethoscope,
  Target,
  CalendarDays,
  Users,
  AlertTriangle,
  BookOpen,
  Rocket,
  Clock,
  FileText,
  MessageCircle,
  ArrowRight,
  Check,
} from "lucide-react";

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

  if (!result) {
    return (
      <div className="-m-5 flex min-h-[80vh] items-center justify-center bg-slate-50 p-5">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-10 py-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-6 w-6 text-slate-400" aria-hidden={true} />
          </div>
          <p className="text-base font-semibold text-slate-900">결과가 없습니다</p>
          <p className="text-sm text-slate-500">리포트 데이터를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const coach = generateReadingCoach({
    ar: result.final_ar ?? 0,
    wpm: result.wpm ?? 0,
    accuracy: result.accuracy ?? 0,
    comprehension: result.comprehension ?? 0,
  });

  const samples = getWordSamples(result);

  return (
    <div className="-m-5 min-h-screen bg-slate-50 p-4 font-sans text-slate-900 md:p-8">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* Hero */}
        <header className="overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900 px-6 py-8 text-white shadow-sm md:px-10 md:py-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-inset ring-white/15">
              <Sparkles className="h-3.5 w-3.5" aria-hidden={true} />
              Premium
            </span>
          </div>
          <h1 className="mt-4 text-balance text-2xl font-bold tracking-tight md:text-3xl">
            AI Premium Reading Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-slate-300">
            AI analyzed your child&apos;s reading performance and built a personalized roadmap.
          </p>

          {coach && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <MapPin className="h-4 w-4 text-white" aria-hidden={true} />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Current Reading Stage
                </p>
                <p className="text-base font-semibold text-white">{coach.stage}</p>
              </div>
            </div>
          )}
        </header>

        {/* Score cards */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Performance Metrics
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PremiumScoreCard title="AR Level" value={result.final_ar ?? 0} max={5} unit="" variant="ar" />
            <PremiumScoreCard title="Reading Speed" value={Math.round(result.wpm ?? 0)} max={180} unit="WPM" />
            <PremiumScoreCard title="Accuracy" value={Math.round(result.accuracy ?? 0)} max={100} unit="%" />
            <PremiumScoreCard title="Comprehension" value={Math.round(result.comprehension ?? 0)} max={100} unit="%" />
          </div>
        </section>

        {/* Roadmap */}
        {coach && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Map className="h-5 w-5 text-indigo-600" aria-hidden={true} />
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Reading Roadmap
              </h2>
            </div>

            {/* Diagnosis + Goal */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Stethoscope className="h-4 w-4" aria-hidden={true} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Core Diagnosis</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{coach.diagnosis}</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Target className="h-4 w-4" aria-hidden={true} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Reading Goal</span>
                </div>
                <p className="mt-3 text-sm font-medium leading-relaxed text-indigo-900">{coach.goal}</p>
              </div>
            </div>

            {/* 4-Week roadmap timeline */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="h-4 w-4" aria-hidden={true} />
                <span className="text-xs font-semibold uppercase tracking-wider">4-Week Reading Roadmap</span>
              </div>
              <ol className="mt-5 space-y-4">
                {coach.roadmap.map((item, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <div className="relative flex flex-col items-center">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      {index < coach.roadmap.length - 1 && (
                        <span className="mt-1 h-full w-px flex-1 bg-slate-200" aria-hidden={true} />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Week {index + 1}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{item}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Parent action */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm md:p-6">
              <div className="flex items-center gap-2 text-emerald-700">
                <Users className="h-4 w-4" aria-hidden={true} />
                <span className="text-xs font-semibold uppercase tracking-wider">Parent Action</span>
              </div>
              <ul className="mt-4 space-y-3">
                {coach.parentAction.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-3 w-3" aria-hidden={true} />
                    </span>
                    <span className="text-sm leading-relaxed text-emerald-900">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Error words */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden={true} />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">대표 오류 단어</h2>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">발음 오류</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {samples.pronunciation.length > 0 ? (
                  samples.pronunciation.map((word: string, i: number) => (
                    <span
                      key={i}
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-100"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">없음</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">읽기 오류</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {samples.missing.length > 0 ? (
                  samples.missing.map((word: string, i: number) => (
                    <span
                      key={i}
                      className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-100"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">없음</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Recommended books */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" aria-hidden={true} />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">추천 도서</h2>
          </div>

          <div className="grid gap-4">
            {rec.short.map((b, i) => (
              <article
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md md:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <BookOpen className="h-5 w-5" aria-hidden={true} />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
                        추천 {i + 1}
                      </p>
                      <h3 className="text-base font-semibold text-slate-900">{b.title}</h3>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    <FileText className="h-3.5 w-3.5" aria-hidden={true} />
                    {b.word_count.toLocaleString()} words
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    <Clock className="h-3.5 w-3.5" aria-hidden={true} />
                    예상 {getReadingTime(b, result)}분
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">추천 이유</p>
                  <ul className="mt-2 space-y-2">
                    {getRecommendationReason(b, result).map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-slate-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden={true} />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 rounded-xl bg-indigo-50/70 px-4 py-3 text-sm font-semibold text-indigo-700">
                  {getReadingPlan(b, result)}
                </div>
              </article>
            ))}
          </div>

          {rec.long.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <Rocket className="h-5 w-5 text-amber-500" aria-hidden={true} />
                <h3 className="text-base font-semibold tracking-tight text-slate-900">
                  도전 읽기 (긴 책)
                </h3>
              </div>

              <div className="grid gap-4">
                {rec.long.map((b, i) => (
                  <article
                    key={i}
                    className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm transition-shadow hover:shadow-md md:p-6"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <Rocket className="h-5 w-5" aria-hidden={true} />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                          도전 {i + 1}
                        </p>
                        <h3 className="text-base font-semibold text-slate-900">{b.title}</h3>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                        <FileText className="h-3.5 w-3.5" aria-hidden={true} />
                        {b.word_count.toLocaleString()} words
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                        <Clock className="h-3.5 w-3.5" aria-hidden={true} />
                        예상 {getReadingTime(b, result)}분
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-600/80">도전 이유</p>
                      <ul className="mt-2 space-y-2">
                        {getRecommendationReason(b, result).map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-slate-600">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden={true} />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 rounded-xl bg-amber-100/70 px-4 py-3 text-sm font-semibold text-amber-800">
                      {getReadingPlan(b, result)}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        {/* CTA */}
        <section className="overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900 px-6 py-8 text-center text-white shadow-sm md:px-10 md:py-10">
          <h2 className="text-balance text-xl font-bold tracking-tight md:text-2xl">
            더 자세한 분석이 필요하신가요?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-slate-300">
            더 자세한 분석을 확인하려면 상담이 필요합니다.
          </p>
          <button
            onClick={() => {
              window.open("https://open.kakao.com/o/gIcwAHli");
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          >
            <MessageCircle className="h-4 w-4" aria-hidden={true} />
            1:1 상담 신청하기
            <ArrowRight className="h-4 w-4" aria-hidden={true} />
          </button>
        </section>
      </main>
    </div>
  );
}

export default function PremiumReportPage() {
  return (
    <Suspense
      fallback={
        <div className="-m-5 flex min-h-[80vh] items-center justify-center bg-slate-50 p-5">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Loading...
          </div>
        </div>
      }
    >
      <ClientPart />
    </Suspense>
  );
}
