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
  Activity,
  Brain,
  TrendingUp,
  Repeat,
  Volume2,
  Flag,
  BarChart3,
  CalendarClock,
  UserCheck,
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
      <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 p-5">
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
  const summary = getPremiumSummary(result);

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900 md:p-6">
      <main className="mx-auto max-w-7xl space-y-5">
        {/* Hero */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 px-6 py-10 text-white shadow-xl shadow-slate-900/10 ring-1 ring-white/10 md:px-12 md:py-14">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl"
            aria-hidden={true}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl"
            aria-hidden={true}
          />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-indigo-300" aria-hidden={true} />
                Premium AI Assessment
              </span>
              <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight md:text-4xl">
                AI Premium Reading Report
              </h1>
              <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-slate-300 md:text-base">
                AI analyzed your child&apos;s reading performance and built a personalized roadmap.
              </p>
            </div>

            {coach && (
              <div className="flex shrink-0 items-center gap-3.5 rounded-2xl bg-white/5 px-5 py-4 ring-1 ring-inset ring-white/10 backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-900/40">
                  <MapPin className="h-6 w-6 text-white" aria-hidden={true} />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                    Current Reading Stage
                  </p>
                  <p className="text-xl font-bold text-white">{coach.stage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Premium KPI row — Stripe Analytics style */}
          <div className="relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-inset ring-white/10 md:grid-cols-4">
            {[
              { label: "AR Level", value: (result.final_ar ?? 0).toFixed(1), unit: "", icon: BookOpen },
              { label: "Reading Speed", value: Math.round(result.wpm ?? 0), unit: "WPM", icon: Activity },
              { label: "Accuracy", value: Math.round(result.accuracy ?? 0), unit: "%", icon: Target },
              { label: "Comprehension", value: Math.round(result.comprehension ?? 0), unit: "%", icon: Brain },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-900/50 px-5 py-5 backdrop-blur transition-colors hover:bg-slate-900/70">
                <div className="flex items-center gap-2 text-slate-400">
                  <stat.icon className="h-3.5 w-3.5" aria-hidden={true} />
                  <p className="text-[11px] font-medium uppercase tracking-widest">{stat.label}</p>
                </div>
                <p className="mt-3 flex items-baseline gap-1.5 text-4xl font-bold tabular-nums leading-none text-white md:text-[2.75rem]">
                  {stat.value}
                  {stat.unit && (
                    <span className="text-sm font-semibold text-indigo-300">{stat.unit}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </header>

        {/* Performance Dashboard */}
        <section>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <BarChart3 className="h-4 w-4" aria-hidden={true} />
            </span>
            <h2 className="text-base font-bold tracking-tight text-slate-900">Performance Dashboard</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Gauges 2x2 */}
            <div className="grid grid-cols-2 gap-4 xl:col-span-2">
              <PremiumScoreCard title="AR Level" value={result.final_ar ?? 0} max={5} unit="" variant="ar" />
              <PremiumScoreCard title="Reading Speed" value={Math.round(result.wpm ?? 0)} max={180} unit="WPM" />
              <PremiumScoreCard title="Accuracy" value={Math.round(result.accuracy ?? 0)} max={100} unit="%" />
              <PremiumScoreCard title="Comprehension" value={Math.round(result.comprehension ?? 0)} max={100} unit="%" />
            </div>

            {/* Insight rail: Core Diagnosis + Reading Goal */}
            {coach && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
                {/* Core Diagnosis — AI insight card */}
                <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                        <Stethoscope className="h-4 w-4" aria-hidden={true} />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Core Diagnosis</span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100">
                      <Sparkles className="h-3 w-3" aria-hidden={true} />
                      AI
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3.5 px-5 py-4">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden={true} />
                        문제 요약
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">{coach.diagnosis}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
                        <Brain className="h-3.5 w-3.5" aria-hidden={true} />
                        AI Analysis
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{summary.cause}</p>
                    </div>
                    <div className="mt-auto rounded-xl bg-emerald-50/70 px-3.5 py-3 ring-1 ring-inset ring-emerald-100">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden={true} />
                        Expected Improvement
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-emerald-900">{summary.solution}</p>
                    </div>
                  </div>
                </div>

                {/* Reading Goal */}
                <div className="flex flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-sm">
                  <div className="flex items-center gap-2.5 border-b border-white/15 px-5 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                      <Flag className="h-4 w-4" aria-hidden={true} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">Reading Goal</span>
                  </div>
                  <div className="flex flex-1 flex-col justify-center px-5 py-4">
                    <p className="text-base font-semibold leading-relaxed text-balance">{coach.goal}</p>
                    <div className="mt-3 flex items-center gap-2 border-t border-white/15 pt-3 text-xs text-indigo-100">
                      <Target className="h-3.5 w-3.5" aria-hidden={true} />
                      <span>Target Stage: <span className="font-bold text-white">{coach.stage}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Roadmap timeline + Parent action */}
        {coach && (
          <section className="grid gap-6 lg:grid-cols-2">
            {/* 4-Week roadmap timeline */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
              <div className="mb-6 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <CalendarDays className="h-4 w-4" aria-hidden={true} />
                </span>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">4-Week Reading Roadmap</span>
              </div>
              <ol className="space-y-0">
                {coach.roadmap.map((item, index) => (
                  <li key={index} className="flex items-stretch gap-4">
                    <div className="relative flex flex-col items-center">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-sm font-bold text-white shadow-md shadow-indigo-600/25">
                        {index + 1}
                      </span>
                      {index < coach.roadmap.length - 1 && (
                        <span className="my-1 w-0.5 flex-1 bg-gradient-to-b from-indigo-200 to-slate-200" aria-hidden={true} />
                      )}
                    </div>
                    <div className={`flex-1 ${index < coach.roadmap.length - 1 ? "pb-5" : ""}`}>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">
                          Week {index + 1}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700">{item}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Parent action — green success cards */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
              <div className="mb-6 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <Users className="h-4 w-4" aria-hidden={true} />
                </span>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">Parent Action</span>
              </div>
              <div className="space-y-3.5">
                {coach.parentAction.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md md:p-5"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                      <Check className="h-4 w-4" aria-hidden={true} />
                    </span>
                    <span className="text-sm font-medium leading-relaxed text-emerald-900">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Weak words — compact practice cards */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <AlertTriangle className="h-4 w-4" aria-hidden={true} />
            </span>
            <h2 className="text-base font-bold tracking-tight text-slate-900">대표 오류 단어</h2>
          </div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-rose-500" aria-hidden={true} />
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">발음 오류</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {samples.pronunciation.length > 0 ? (
                  samples.pronunciation.map((word: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-rose-100 bg-rose-50/50 py-2 pl-3 pr-2.5"
                    >
                      <div className="text-left">
                        <p className="text-sm font-bold leading-tight text-slate-900">{word}</p>
                        <p className="text-[10px] font-medium leading-tight text-rose-600">발음 교정 필요</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-1 text-[10px] font-bold text-rose-600 ring-1 ring-inset ring-rose-200">
                        <Repeat className="h-3 w-3" aria-hidden={true} />
                        연습
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">없음</span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" aria-hidden={true} />
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">읽기 오류</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {samples.missing.length > 0 ? (
                  samples.missing.map((word: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50/50 py-2 pl-3 pr-2.5"
                    >
                      <div className="text-left">
                        <p className="text-sm font-bold leading-tight text-slate-900">{word}</p>
                        <p className="text-[10px] font-medium leading-tight text-amber-600">정확도 향상 필요</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-1 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-200">
                        <Repeat className="h-3 w-3" aria-hidden={true} />
                        연습
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">없음</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Recommended books — premium product cards */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <BookOpen className="h-4 w-4" aria-hidden={true} />
            </span>
            <h2 className="text-base font-bold tracking-tight text-slate-900">추천 도서</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rec.short.map((b, i) => {
              const minutes = getReadingTime(b, result);
              const difficulty = minutes <= 20 ? "쉬움" : minutes <= 40 ? "보통" : "도전";
              return (
                <article
                  key={i}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Cover placeholder */}
                  <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 via-indigo-600 to-slate-900">
                    <BookOpen className="h-10 w-10 text-white/30 transition-transform duration-300 group-hover:scale-110" aria-hidden={true} />
                    <span className="absolute left-3 top-3 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-bold text-white backdrop-blur ring-1 ring-inset ring-white/20">
                      AR {b.ar_min}–{b.ar_max}
                    </span>
                    <span className="absolute right-3 top-3 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-indigo-700 shadow-sm">
                      {difficulty}
                    </span>
                    <span className="absolute bottom-3 left-3 text-[11px] font-semibold uppercase tracking-widest text-white/80">
                      추천 {i + 1}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-base font-bold leading-snug text-slate-900">{b.title}</h3>

                    <div className="mt-2.5 flex items-center gap-3 text-xs font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden={true} />
                        {minutes}분
                      </span>
                      <span className="h-3 w-px bg-slate-200" aria-hidden={true} />
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" aria-hidden={true} />
                        {b.word_count.toLocaleString()} words
                      </span>
                    </div>

                    <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                      {getRecommendationReason(b, result)[0]}
                    </p>

                    <div className="mt-3 rounded-lg bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700">
                      {getReadingPlan(b, result)}
                    </div>

                    <button
                      onClick={() => {
                        window.open("https://open.kakao.com/o/gIcwAHli");
                      }}
                      className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                      이 책으로 시작하기
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden={true} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {rec.long.length > 0 && (
            <>
              <div className="flex items-center gap-2.5 pt-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Rocket className="h-4 w-4" aria-hidden={true} />
                </span>
                <h3 className="text-base font-bold tracking-tight text-slate-900">
                  도전 읽기 (긴 책)
                </h3>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {rec.long.map((b, i) => {
                  const minutes = getReadingTime(b, result);
                  return (
                    <article
                      key={i}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      {/* Cover placeholder */}
                      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-amber-400 via-amber-500 to-orange-700">
                        <Rocket className="h-10 w-10 text-white/30 transition-transform duration-300 group-hover:scale-110" aria-hidden={true} />
                        <span className="absolute left-3 top-3 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-bold text-white backdrop-blur ring-1 ring-inset ring-white/20">
                          AR {b.ar_min}–{b.ar_max}
                        </span>
                        <span className="absolute right-3 top-3 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-amber-700 shadow-sm">
                          도전
                        </span>
                        <span className="absolute bottom-3 left-3 text-[11px] font-semibold uppercase tracking-widest text-white/80">
                          도전 {i + 1}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="text-base font-bold leading-snug text-slate-900">{b.title}</h3>

                        <div className="mt-2.5 flex items-center gap-3 text-xs font-medium text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" aria-hidden={true} />
                            {minutes}분
                          </span>
                          <span className="h-3 w-px bg-slate-200" aria-hidden={true} />
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" aria-hidden={true} />
                            {b.word_count.toLocaleString()} words
                          </span>
                        </div>

                        <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                          {getRecommendationReason(b, result)[0]}
                        </p>

                        <div className="mt-3 rounded-lg bg-amber-100/70 px-3 py-2 text-xs font-semibold text-amber-800">
                          {getReadingPlan(b, result)}
                        </div>

                        <button
                          onClick={() => {
                            window.open("https://open.kakao.com/o/gIcwAHli");
                          }}
                          className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                        >
                          도전 시작하기
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden={true} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 px-6 py-12 text-center text-white shadow-xl shadow-slate-900/10 ring-1 ring-white/10 md:px-10 md:py-16">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl"
            aria-hidden={true}
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl"
            aria-hidden={true}
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" aria-hidden={true} />
              Premium Coaching
            </span>
            <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight md:text-3xl">
              더 깊이 있는 AI 코칭이 필요하신가요?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-slate-300 md:text-base">
              1:1 상담을 통해 아이만을 위한 맞춤 독서 코칭을 시작하세요.
            </p>

            <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { icon: BarChart3, title: "Weekly Report", desc: "매주 성장 리포트" },
                { icon: CalendarClock, title: "Personal Reading Plan", desc: "맞춤 독서 플랜" },
                { icon: UserCheck, title: "Parent Coaching", desc: "학부모 코칭 제공" },
              ].map((benefit) => (
                <div
                  key={benefit.title}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 px-4 py-5 ring-1 ring-inset ring-white/10 backdrop-blur"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-900/40">
                    <benefit.icon className="h-5 w-5 text-white" aria-hidden={true} />
                  </span>
                  <p className="text-sm font-bold text-white">{benefit.title}</p>
                  <p className="text-xs text-slate-400">{benefit.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                window.open("https://open.kakao.com/o/gIcwAHli");
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-xl"
            >
              <MessageCircle className="h-4 w-4" aria-hidden={true} />
              1:1 상담 신청하기
              <ArrowRight className="h-4 w-4" aria-hidden={true} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function PremiumReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 p-5">
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
