"use client";

import { useEffect, useRef, useState } from "react";
import { blobToPCM16kMono } from "@/app/components/utilsAudio";
import { supabase } from "@/lib/supabase-client";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Mic,
  Square,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Timer,
  Gauge,
  Target,
  Brain,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Rocket,
} from "lucide-react";

/* ---------------- AR 계산 ---------------- */

const calculateBaseAR = (wpm: number) => {
  const capped = Math.min(wpm, 180);
  if (capped <= 60) return 1.0;
  if (capped <= 80) return 1.0 + (capped - 60) / 20;
  if (capped <= 120) return 2.0 + (capped - 80) / 40;
  if (capped <= 150) return 3.0 + (capped - 120) / 30;
  return 4.0 + ((capped - 150) / 30) * 0.9;
};

function getComprehensionPenalty(score: number) {
  if (score >= 80) return 0;
  if (score >= 70) return 0.4;
  if (score >= 60) return 0.8;
  return 1.2;
}

function getBaseAR(wpm: number) {
  if (wpm <= 10) return 0.8;
  if (wpm <= 20) return 0.8 + ((wpm - 10) / 10) * (1.0 - 0.8);
  if (wpm <= 30) return 1.0 + ((wpm - 20) / 10) * (1.2 - 1.0);
  if (wpm <= 40) return 1.2 + ((wpm - 30) / 10) * (1.5 - 1.2);
  if (wpm <= 60) return 1.5 + ((wpm - 40) / 20) * (1.8 - 1.5);
  if (wpm <= 80) return 1.8 + ((wpm - 60) / 20) * (2.0 - 1.8);
  if (wpm <= 120) return 2.0 + ((wpm - 80) / 40) * 1.0;
  if (wpm <= 150) return 3.0 + ((wpm - 120) / 30) * 1.0;
  if (wpm <= 180) return 4.0 + ((wpm - 150) / 30) * 1.0;
  return 5.0;
}

const getAccuracyPenalty = (accuracy: number) => {
  if (accuracy >= 85) return 0;
  if (accuracy >= 80) return 0.1;
  if (accuracy >= 75) return 0.2;
  return 0.3;
};

const generateParentComment = (
  wpm: number,
  accuracy: number,
  comprehensionScore: number
) => {
  if (comprehensionScore < 60)
    return "읽기 속도는 나쁘지 않지만 이해력이 부족합니다. 요약 훈련이 필요합니다.";
  if (accuracy < 75)
    return "이해는 가능하지만 발음 정확도가 낮습니다. 반복 읽기를 권장합니다.";
  if (wpm > 150 && comprehensionScore >= 80)
    return "속도와 이해가 모두 우수합니다. 상위 레벨 도서로 확장 가능합니다.";
  if (wpm < 90)
    return "정확도는 좋지만 읽기 속도가 느립니다. 짧은 문장 반복 훈련이 필요합니다.";

  return "전반적으로 안정적인 읽기 수준입니다. 현재 레벨에서 반복 읽기를 권장합니다.";
};

type Phase = "ready" | "countdown" | "reading" | "recall" | "result";
type RecallPhase = "idle" | "recording" | "recorded" | "submitting";

export default function StepTestClient({
  user,
  profileId,
}: {
  user: any;
  profileId: string;
}) {
  const searchParams = useSearchParams();
  const level = searchParams.get("level");
  const router = useRouter();

  if (!profileId) {
    console.error("profileId 없음 → 잘못된 접근");
    router.replace("/");
    return null;
  }

  const [feedback, setFeedback] = useState({
    understood: "",
    helpful: "",
    paid: "",
    comment: "",
  });
  const [resultId, setResultId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [recallPhase, setRecallPhase] = useState<RecallPhase>("idle");
  const [countdown, setCountdown] = useState(7);
  const [currentLevel, setCurrentLevel] = useState<"AR1" | "AR2" | "AR3">("AR1");

  const [passage, setPassage] = useState<any>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recallBlob, setRecallBlob] = useState<Blob | null>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recallRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recallChunksRef = useRef<Blob[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [lastPassageId, setLastPassageId] = useState<number | null>(null);

  useEffect(() => {
    if (!level) return;
    if (level === "ar2") setSelectedLevel("2.0");
    else if (level === "ar3") setSelectedLevel("3.0");
  }, [level]);

  useEffect(() => {
    const loadPassage = async () => {
      if (!selectedLevel) return;
      const lvl = parseFloat(selectedLevel);

      const { data } = await supabase
        .from("passages")
        .select("*")
        .gte("ar_max", lvl)
        .lte("ar_min", lvl);

      if (data && data.length > 0) {
        let candidates = data;
        if (lastPassageId) {
          candidates = data.filter((p) => p.id !== lastPassageId);
        }
        if (candidates.length === 0) candidates = data;

        const random = candidates[Math.floor(Math.random() * candidates.length)];
        setPassage(random);
        setLastPassageId(random.id);
      }
    };

    loadPassage();
  }, [selectedLevel]);

  /* ---------------- 카운트다운 ---------------- */
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      startReadingRecording();
      return;
    }
    const timer = setTimeout(() => setCountdown((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  /* ---------------- 읽기 녹음 ---------------- */
  const startReadingRecording = async () => {
    setPhase("reading");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const chunks = audioChunksRef.current;
      if (chunks.length === 0) {
        alert("읽기 녹음 실패");
        return;
      }
      const blob = new Blob(chunks, { type: "audio/webm" });
      setAudioBlob(blob);
      stream.getTracks().forEach((t) => t.stop());
      setPhase("recall");
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;

    setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, 60000);
  };

  /* ---------------- 재진술 녹음 ---------------- */
  const startRecallRecording = async () => {
    setRecallPhase("recording");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recallChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recallChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const chunks = recallChunksRef.current;
      if (chunks.length === 0) {
        alert("설명 녹음 실패");
        return;
      }
      const blob = new Blob(chunks, { type: "audio/webm" });
      setRecallBlob(blob);
      stream.getTracks().forEach((t) => t.stop());
      setRecallPhase("recorded");
    };

    recorder.start();
    recallRecorderRef.current = recorder;

    setTimeout(() => {
      if (recallRecorderRef.current?.state === "recording") {
        recallRecorderRef.current.stop();
      }
    }, 60000);
  };

  const submitRecall = async (blob?: Blob) => {
    const finalBlob = blob || recallBlob;
    if (!finalBlob) {
      alert("녹음을 먼저 완료해주세요");
      return;
    }

    setRecallPhase("submitting");
    await runAssessment(finalBlob, audioBlob);
  };

  /* ---------------- 평가 실행 ---------------- */
  /* ---------------- 평가 실행 ---------------- */
  const runAssessment = async (
    recallBlobParam: Blob,
    audioBlobParam: Blob | null
  ) => {
    if (!passage || !passage.content) {
      alert("지문이 없습니다");
      return;
    }

    if (!audioBlobParam || !recallBlobParam) {
      alert("녹음 파일이 없습니다");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    const refText = passage.content;
    const originalWords = refText.trim().split(/\s+/);
    const originalWordCount = originalWords.length;

    // ---------------- 발음 평가 API 호출 ----------------
    const pcmBytes = await blobToPCM16kMono(audioBlobParam);
    const formData = new FormData();
    formData.append("audio", new Blob([new Uint8Array(pcmBytes)]));
    formData.append("text", refText);
    formData.append("user_id", currentUser.id);

    const pronunRes = await fetch("/api/pronun", {
      method: "POST",
      body: formData,
    });

    if (!pronunRes.ok) {
      alert("발음 분석 실패");
      return;
    }

    const pronunData = await pronunRes.json();
    const durationSec = Math.max(1, pronunData.durationSec || 1);
    const recognizedText = pronunData.recognizedText || "";
    const wrongWords = pronunData.wrongWords || [];
    const badPronunciations = pronunData.badPronunciations || [];

    // 🔥 [보정 1]: 실제 일치 단어 수 기반의 정밀 WPM 산출
    const correctWordCount = Math.max(0, originalWordCount - wrongWords.length);
    const wpm = Math.min(250, Math.round((correctWordCount / durationSec) * 60));
    const readingCoverage = Math.min(1, correctWordCount / originalWordCount);

    // 🔥 [보정 2]: 단어 일치 비율 기반 읽기 정확도 (49% 오류 차단)
    const calculatedWordAccuracy = Math.max(
      0,
      Math.round((correctWordCount / originalWordCount) * 100)
    );
    const rawSttAccuracy = pronunData.accuracy ?? 100;
    const accuracy = Math.max(calculatedWordAccuracy, Math.round(rawSttAccuracy));

    const pronunciationAccuracy = Math.round(
      pronunData.pronunciationAccuracy || accuracy
    );

    // ---------------- 이해도 평가 API 호출 ----------------
    let recallPCM;
    try {
      recallPCM = await blobToPCM16kMono(recallBlobParam);
    } catch (e) {
      alert("음성 변환 실패");
      return;
    }

    const recallForm = new FormData();
    recallForm.append("audio", new Blob([new Uint8Array(recallPCM)]));
    recallForm.append("text", refText);
    recallForm.append("user_id", currentUser.id);
    recallForm.append("wpm", String(wpm));
    recallForm.append("accuracy", String(accuracy));

    const compRes = await fetch("/api/comprehension", {
      method: "POST",
      body: recallForm,
    });

    let compData;
    if (compRes.ok) {
      const text = await compRes.text();
      try {
        compData = JSON.parse(text);
      } catch (e) {
        compData = { score: 0, summary: "분석 결과를 불러오지 못했습니다." };
      }
    } else {
      compData = { score: 0, summary: "이해도 분석에 실패했습니다." };
    }

    const baseScore = compData.score || 0;
    const recallText = compData.recallText || "";

    // 🔥 [보정 3]: String.filter() 타입 에러 수정 및 안정적 이해도 점수 산출
    const recallWords = recallText.trim().split(/\s+/).filter(Boolean);
    const recallWordCount = recallWords.length;

    let finalScore = baseScore;

    if (recallWordCount < 3 && recallText.length < 5) {
      finalScore = 0; // 녹음이 미진행된 경우
    } else if (recallWordCount < 5) {
      finalScore = Math.max(baseScore * 0.8, 50); // 짧게 핵심만 말한 경우 최소점 보장
    }

    if (isNaN(finalScore)) {
      finalScore = baseScore || 70;
    }

    const comprehensionScore = Math.min(100, Math.round(finalScore));

    // ---------------- AR 및 최종 지표 계산 ----------------
    const baseAR = getBaseAR(wpm);
    let finalAR =
      baseAR -
      getAccuracyPenalty(accuracy) -
      getComprehensionPenalty(comprehensionScore);
    finalAR = Math.max(0.5, Math.min(5.0, finalAR));

    let minCoverage = 0.3;
    if (finalAR < 2) minCoverage = 0.2;
    else if (finalAR < 3) minCoverage = 0.3;
    else minCoverage = 0.4;

    if (readingCoverage < minCoverage) {
      alert("읽기가 충분하지 않아 결과를 계산할 수 없습니다.");
      setPhase("ready");
      return;
    }

    const safeWpm = isNaN(wpm) ? 0 : wpm;
    const safeAccuracy = isNaN(accuracy) ? 0 : accuracy;

    // ---------------- DB 저장 ----------------
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    await supabase.from("reading_results").insert([
      {
        user_id: currentUser.id,
        profile_id: profileId,
        student_id: profile?.student_id,
        wpm: safeWpm,
        accuracy: safeAccuracy,
        comprehension: comprehensionScore,
        final_ar: finalAR,
        duration_sec: durationSec,
        spoken_words: correctWordCount,
        total_words: originalWordCount,
        coverage: readingCoverage,
        recognized_text: recognizedText,
        reference_text: refText,
        bad_pronunciations: badPronunciations,
        wrong_words: wrongWords,
        ai_score: compData.score ?? 0,
        ai_comment: compData.summary ?? "분석 결과 없음",
        recall_text: recallText,
      },
    ]);

    let levelUp: "AR2" | "AR3" | null = null;
    if (currentLevel === "AR1" && safeWpm >= 80 && safeAccuracy >= 85) levelUp = "AR2";
    if (currentLevel === "AR2" && safeWpm >= 120 && safeAccuracy >= 90) levelUp = "AR3";

    setRecallPhase("idle");
    setFinalResult({
      baseAR,
      final_ar: finalAR,
      wpm: safeWpm,
      accuracy: safeAccuracy,
      pronunciationAccuracy,
      comprehensionScore,
      durationSec,
      spokenWordCount: correctWordCount,
      originalWordCount,
      readingCoverage,
      ai_comment: compData.summary,
      wrong_words: wrongWords,
      badPronunciations: badPronunciations,
      levelUp,
    });

    setPhase("result");
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        {/* READY */}
        {phase === "ready" && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-300">
                <BookOpen className="h-4 w-4" aria-hidden={true} />
                Reading Assessment
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl text-balance">
                레벨을 선택하세요
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                아이의 현재 읽기 수준에 맞는 AR 레벨을 골라 테스트를 시작합니다.
              </p>
            </div>

            <div className="px-6 py-8 sm:px-10">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: "1.0", label: "AR 1.0", desc: "입문 단계" },
                  { value: "2.0", label: "AR 2.0", desc: "기초 단계" },
                  { value: "3.0", label: "AR 3.0", desc: "발전 단계" },
                ].map((opt) => {
                  const active = selectedLevel === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer flex-col rounded-2xl border p-4 transition-all ${
                        active
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="level"
                        value={opt.value}
                        checked={active}
                        onChange={(e) => {
                          setPassage(null);
                          setSelectedLevel(e.target.value);
                        }}
                        className="sr-only"
                      />
                      <span
                        className={`text-lg font-semibold ${
                          active ? "text-indigo-700" : "text-slate-900"
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="mt-1 text-sm text-slate-500">{opt.desc}</span>
                    </label>
                  );
                })}
              </div>

              {selectedLevel && !passage && (
                <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                  <Sparkles className="h-4 w-4 animate-pulse text-indigo-500" aria-hidden={true} />
                  지문 불러오는 중...
                </p>
              )}

              <button
                onClick={() => {
                  if (!selectedLevel) {
                    alert("레벨을 선택하세요");
                    return;
                  }
                  if (!passage) {
                    alert("지문을 불러오는 중입니다");
                    return;
                  }
                  setPhase("countdown");
                }}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                <Play className="h-5 w-5" aria-hidden={true} />
                시작하기
              </button>
            </div>
          </div>
        )}

        {/* COUNTDOWN */}
        {phase === "countdown" && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-12 text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-indigo-300">
                읽을 준비를 하세요
              </p>
              <div className="mt-4 flex h-28 w-28 items-center justify-center rounded-full border-4 border-indigo-500/40 bg-slate-800/60">
                <span className="text-5xl font-bold text-white tabular-nums">{countdown}</span>
              </div>
            </div>
            <blockquote className="px-6 py-8 text-lg leading-relaxed text-slate-700 sm:px-10">
              {passage.content}
            </blockquote>
          </div>
        )}

        {/* READING */}
        {phase === "reading" && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden={true} />
                지문을 읽으세요 · 녹음 중
              </h3>

              <button
                onClick={() => {
                  if (mediaRecorderRef.current?.state === "recording") {
                    mediaRecorderRef.current.stop();
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Square className="h-4 w-4" aria-hidden={true} />
                녹음 종료
              </button>
            </div>

            <blockquote className="px-6 py-8 text-xl leading-relaxed text-slate-800 sm:px-10">
              {passage.content}
            </blockquote>
          </div>
        )}

        {/* RECALL */}
        {phase === "recall" && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 sm:px-10">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-300">
                <Brain className="h-4 w-4" aria-hidden={true} />
                Recall
              </div>
              <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl text-balance">
                방금 읽은 내용을 설명하세요
              </h3>
            </div>

            <div className="flex flex-wrap gap-3 px-6 py-8 sm:px-10">
              {recallPhase === "idle" && (
                <button
                  onClick={startRecallRecording}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <Mic className="h-4 w-4" aria-hidden={true} />
                  설명 시작
                </button>
              )}

              {recallPhase === "recording" && (
                <button
                  onClick={() => recallRecorderRef.current?.stop()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  <Square className="h-4 w-4" aria-hidden={true} />
                  설명 마치기
                </button>
              )}

              {recallPhase === "recorded" && (
                <>
                  <button
                    onClick={startRecallRecording}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden={true} />
                    다시 녹음
                  </button>
                  <button
                    onClick={() => submitRecall()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <Send className="h-4 w-4" aria-hidden={true} />
                    제출하기
                  </button>
                </>
              )}

              {recallPhase === "submitting" && (
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Sparkles className="h-4 w-4 animate-pulse text-indigo-500" aria-hidden={true} />
                  AI 분석 중...
                </p>
              )}
            </div>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && finalResult && (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-6 sm:px-10">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <Sparkles className="h-5 w-5 text-indigo-500" aria-hidden={true} />
                  발음 / 이해 피드백
                </h3>

                <div className="mt-3">
                  {finalResult?.ai_comment ? (
                    <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                      {finalResult.ai_comment}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">분석 결과 없음</p>
                  )}
                </div>
              </div>

              <div className="space-y-6 px-6 py-6 sm:px-10">
                {finalResult?.wrong_words?.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <BookOpen className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                      읽기에서 놓친 단어
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {finalResult.wrong_words.map((w: string, i: number) => (
                        <span
                          key={i}
                          className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {finalResult?.badPronunciations?.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <AlertCircle className="h-4 w-4 text-red-500" aria-hidden={true} />
                      발음이 어려운 단어
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      다음 단어는 발음 정확도가 낮았습니다.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {finalResult.badPronunciations.slice(0, 5).map((w: string, i: number) => (
                        <span
                          key={i}
                          className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {finalResult?.wrong_words?.length === 0 &&
                  finalResult?.badPronunciations?.length === 0 && (
                    <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" aria-hidden={true} />
                      읽기와 발음 모두 안정적입니다.
                    </div>
                  )}

                {finalResult && finalResult.levelUp === "AR3" && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="flex items-center gap-2 font-semibold text-amber-900">
                      <Rocket className="h-5 w-5" aria-hidden={true} />
                      매우 빠르고 정확하게 읽고 있습니다.
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-800">
                      이 테스트는 기본 수준 확인용입니다. AR 3.0 단계 테스트를 진행해 보세요.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentLevel("AR3");
                        setFinalResult(null);
                        setCountdown(7);
                        setSelectedLevel("3.0");
                        setPhase("ready");
                      }}
                      className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                    >
                      AR 3.0 테스트 하기
                    </button>
                  </div>
                )}

                {finalResult && finalResult.levelUp === "AR2" && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                    <p className="flex items-center gap-2 font-semibold text-sky-900">
                      <TrendingUp className="h-5 w-5" aria-hidden={true} />
                      읽기 속도가 안정적으로 올라왔습니다.
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-sky-800">
                      AR 2.0 단계 테스트로 넘어가세요.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentLevel("AR2");
                        setFinalResult(null);
                        setCountdown(7);
                        setSelectedLevel("2.0");
                        setPhase("ready");
                      }}
                      className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
                    >
                      AR 2.0 테스트 하기
                    </button>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Gauge className="h-5 w-5 text-indigo-500" aria-hidden={true} />
                    리딩 진단 결과
                  </h2>

                  {!finalResult.levelUp && (
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5">
                      <span className="text-sm font-medium uppercase tracking-widest text-indigo-300">
                        AR Level
                      </span>
                      <span className="text-3xl font-bold text-white tabular-nums">
                        {finalResult.final_ar.toFixed(1)}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <Timer className="h-4 w-4" aria-hidden={true} />
                        읽기 속도
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                        {finalResult?.wpm ? Math.round(finalResult.wpm) : "-"}
                        <span className="ml-1 text-sm font-normal text-slate-400">WPM</span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <Target className="h-4 w-4" aria-hidden={true} />
                        읽기 정확도
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                        {finalResult.accuracy ?? "-"}
                        <span className="ml-0.5 text-sm font-normal text-slate-400">%</span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <Mic className="h-4 w-4" aria-hidden={true} />
                        발음 정확도
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                        {finalResult.pronunciationAccuracy ?? "-"}
                        <span className="ml-0.5 text-sm font-normal text-slate-400">%</span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <Brain className="h-4 w-4" aria-hidden={true} />
                        이해도
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                        {Math.round(finalResult.comprehensionScore)}
                        <span className="ml-0.5 text-sm font-normal text-slate-400">%</span>
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                    {generateParentComment(
                      finalResult.wpm,
                      finalResult.accuracy,
                      finalResult.comprehensionScore
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* FEEDBACK FORM */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5 sm:px-10">
                <p className="text-base font-semibold text-slate-900">10초 피드백</p>
                <p className="mt-1 text-sm text-slate-500">
                  더 나은 서비스를 위해 의견을 들려주세요.
                </p>
              </div>

              <div className="space-y-5 px-6 py-6 sm:px-10">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    1. 결과 이해되셨나요?
                  </label>
                  <select
                    onChange={(e) => setFeedback({ ...feedback, understood: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">선택</option>
                    <option>매우 그렇다</option>
                    <option>보통</option>
                    <option>아니다</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    2. 도움이 되었나요?
                  </label>
                  <select
                    onChange={(e) => setFeedback({ ...feedback, helpful: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">선택</option>
                    <option>매우 그렇다</option>
                    <option>보통</option>
                    <option>아니다</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    3. 유료라면 사용할 의향 있으신가요?
                  </label>
                  <select
                    onChange={(e) => setFeedback({ ...feedback, paid: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">선택</option>
                    <option>있다</option>
                    <option>고민</option>
                    <option>없다</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    가장 궁금한 점 1가지만 적어주세요
                  </label>
                  <textarea
                    onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                    className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  onClick={async () => {
                    const {
                      data: { user: authUser },
                    } = await supabase.auth.getUser();

                    if (!authUser) {
                      alert("로그인이 필요합니다");
                      return;
                    }

                    const { error } = await supabase.from("feedbacks").insert({
                      user_id: authUser.id,
                      result_id: resultId,
                      understood: feedback.understood,
                      helpful: feedback.helpful,
                      paid: feedback.paid,
                      comment: feedback.comment,
                    });

                    if (error) {
                      console.error(error);
                      alert("저장 실패");
                      return;
                    }

                    alert("감사합니다!");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <Send className="h-4 w-4" aria-hidden={true} />
                  제출
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}