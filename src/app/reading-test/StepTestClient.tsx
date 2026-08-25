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

/* ---------------- AR 계산 ----------------
 * WPM(읽기 속도)으로 산출한 "속도가 시사하는 레벨"(speedAR)을 1차 신호로 삼는다.
 * 정확도/이해도는 레벨을 가르는 스위치가 아니라, 그 속도를 얼마나 신뢰할지 정하는
 * 연속 가중치(trust)로만 쓰인다. 지문 자체의 난이도(passages.ar_min/ar_max)는 하드
 * 게이트가 아니라, trust가 낮을 때 되돌아갈 사전정보(textCenter)로만 작동한다.
 *
 * trust가 낮은 상태에서 speedAR이 textCenter보다 높으면 초과분을 trust만큼만 인정한다
 * (2026-08-09 재설계 이전의 "쉬운 지문을 빨리 읽으면 이해도와 무관하게 고득점" 버그가
 * 재발하지 않도록). speedAR이 textCenter보다 낮으면 기본적으로 속도를 그대로 신뢰하고,
 * trust가 낮을 때만 소폭 완화한다(느린 속도 자체는 신뢰도를 의심할 근거가 약함).
 */

// wpm↔AR 벤치마크 곡선의 앵커 포인트 (양방향 조회에 재사용)
const WPM_AR_POINTS: [number, number][] = [
  [10, 0.8],
  [20, 1.0],
  [30, 1.2],
  [40, 1.5],
  [60, 1.8],
  [80, 2.0],
  [120, 3.0],
  [150, 4.0],
  [180, 5.0],
];

// "속도만 봤을 때 시사되는 레벨" (wpm → AR) — 최종 점수의 1차 신호
function wpmIndicatedAR(wpm: number) {
  const capped = Math.min(wpm, WPM_AR_POINTS[WPM_AR_POINTS.length - 1][0]);
  if (capped <= WPM_AR_POINTS[0][0]) return WPM_AR_POINTS[0][1];

  for (let i = 0; i < WPM_AR_POINTS.length - 1; i++) {
    const [wpm0, ar0] = WPM_AR_POINTS[i];
    const [wpm1, ar1] = WPM_AR_POINTS[i + 1];
    if (capped >= wpm0 && capped <= wpm1) {
      return ar0 + ((capped - wpm0) / (wpm1 - wpm0)) * (ar1 - ar0);
    }
  }
  return WPM_AR_POINTS[WPM_AR_POINTS.length - 1][1];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// trust 램프 구간 — 50%에서 신뢰도 0, 95%에서 신뢰도 1 (기존 Betts 기반 좌절/독립 경계값 재사용)
const TRUST_LOW = 50;
const TRUST_HIGH = 95;
// speedAR이 textCenter보다 낮을 때, trust가 낮은 경우 되돌아가는 폭의 상한(AR 절대값 기준 고정폭).
// 실제 결과 데이터로 백테스트해보니 textCenter와의 "격차 비율"로 계산하면 지문이 학생 실력보다
// 훨씬 어려울 때(예: 실력은 AR1.6대인데 지문이 AR8.6대) 그 격차의 30%가 그대로 반영돼 결과가
// 비상식적으로 튀는 문제가 있었다(1.65 → 3.74). 격차와 무관한 고정폭으로 바꿔서, 아무리 신뢰도가
// 낮아도 "약간의 배려" 이상으로는 위로 튀지 않게 막는다.
const MAX_BELOW_LIFT = 0.3;

type ReadingLevel = "frustration" | "instructional" | "independent";

// "AR1"~"AR4" 표기 <-> 레벨 선택 화면의 selectedLevel 값("1.0"~"4.0") 상호 변환용
const LEVEL_TO_SELECT_VALUE: Record<"AR1" | "AR2" | "AR3" | "AR4", string> = {
  AR1: "1.0",
  AR2: "2.0",
  AR3: "3.0",
  AR4: "4.0",
};

const LEVEL_OPTIONS = [
  { value: "1.0", label: "AR 1.0", desc: "입문 단계" },
  { value: "2.0", label: "AR 2.0", desc: "기초 단계" },
  { value: "3.0", label: "AR 3.0", desc: "발전 단계" },
  { value: "4.0", label: "AR 4.0", desc: "심화 단계" },
];

function calculateFinalAR(
  arMin: number,
  arMax: number,
  wpm: number,
  accuracy: number,
  comprehension: number
): { finalAR: number; level: ReadingLevel } {
  const speedAR = wpmIndicatedAR(wpm);
  const textCenter = (arMin + arMax) / 2;

  const accuracyTrust = clamp01((accuracy - TRUST_LOW) / (TRUST_HIGH - TRUST_LOW));
  const comprehensionTrust = clamp01((comprehension - TRUST_LOW) / (TRUST_HIGH - TRUST_LOW));
  // 둘 다 받쳐줘야 신뢰도가 높아짐 — 하나라도 약하면 곱셈으로 확 낮아진다
  // (기존 "accuracy<90 OR comprehension<50" 하드 게이트의 정신을 연속값으로 계승)
  const trust = accuracyTrust * comprehensionTrust;

  let baseAR: number;
  if (speedAR >= textCenter) {
    // 속도가 지문 난이도를 앞질렀을 때 — 초과분은 trust만큼만 인정
    baseAR = textCenter + (speedAR - textCenter) * trust;
  } else {
    // 속도가 지문 난이도에 못 미칠 때 — 기본은 속도를 그대로 신뢰, trust가 낮을 때만 고정폭만큼만
    // 위로 배려하되 textCenter는 절대 넘지 않는다(지문 자체보다 더 쉬웠다고 인정할 순 없으므로)
    baseAR = Math.min(speedAR + MAX_BELOW_LIFT * (1 - trust), textCenter);
  }

  const finalAR = Math.max(0.5, Math.min(5.0, baseAR));
  const level: ReadingLevel =
    finalAR < arMin ? "frustration" : finalAR > arMax ? "independent" : "instructional";

  return { finalAR, level };
}

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

  const [passage, setPassage] = useState<any>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recallBlob, setRecallBlob] = useState<Blob | null>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recallRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recallChunksRef = useRef<Blob[]>([]);
  const readingStartRef = useRef<number | null>(null);
  const readingDurationSecRef = useRef<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [lastPassageId, setLastPassageId] = useState<number | null>(null);
  const [passageReloadKey, setPassageReloadKey] = useState(0);
  // null = 아직 확인 전, 이 값이 나오기 전까지는 막힌 걸로 단정하지 않는다(최종 관문은
  // 어차피 /api/pronun 쪽 서버 체크). 레벨/지문을 고르기도 전, 화면 진입 시점에 미리
  // 확인해서 다 읽고 녹음까지 마친 뒤에야 "오늘 다 썼습니다"라고 뜨는 걸 막는다.
  const [eligibility, setEligibility] = useState<{ allowed: boolean; reason?: string } | null>(null);

  useEffect(() => {
    if (!level) return;
    if (level === "ar2") setSelectedLevel("2.0");
    else if (level === "ar3") setSelectedLevel("3.0");
    else if (level === "ar4") setSelectedLevel("4.0");
  }, [level]);

  useEffect(() => {
    // ready 화면에 들어올 때마다 다시 확인한다. 마운트 시 1회만 체크하면, 결과 화면의
    // "OO 테스트 하기" 버튼으로 페이지 새로고침 없이 연달아 재도전할 때 맨 처음(아직 0회)
    // 체크한 값이 계속 남아있어서 — 이미 오늘 3회를 다 채운 뒤에도 계속 통과돼버렸다.
    if (phase !== "ready") return;

    let active = true;

    const runCheck = async (accessToken: string) => {
      try {
        const res = await fetch("/api/reading-test/check-eligibility", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await res.json();
        if (active) setEligibility(result);
      } catch {
        // 확인 자체가 실패해도 진행은 막지 않는다 — 실제 제출 시점의 서버 체크가 최종 관문
        if (active) setEligibility({ allowed: true });
      }
    };

    // getSession()을 컴포넌트 마운트 시점에 한 번만 부르면, 페이지를 직접 새로고침했을 때
    // Supabase 클라이언트가 로컬스토리지에서 세션을 아직 복원하기 전이라 토큰이 비어있는
    // 경우가 있었다(그러면 그냥 조용히 통과되어 버림). onAuthStateChange로 세션이 실제로
    // 준비되는 시점을 놓치지 않고 잡는다.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) runCheck(data.session.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) runCheck(session.access_token);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [phase]);

  useEffect(() => {
    const loadPassage = async () => {
      if (!selectedLevel || !user?.id) return;
      const lvl = parseFloat(selectedLevel);

      // 1. 유저가 이미 풀어본 지문(passage) 이력 — 지문(content)별 "가장 최근에 푼 시각"까지
      // 확보한다. 다 풀어본 뒤 매번 전체에서 순수 무작위로 재추첨하면 후보 수가 적을 때 같은
      // 지문이 연달아 몰리기 쉬웠다 — 고갈 후에는 가장 오래전에 푼 지문부터 순환하도록 한다.
      const { data: userHistory } = await supabase
        .from("reading_results")
        .select("reference_text, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      const lastReadAt = new Map<string, string>();
      (userHistory || []).forEach((h) => {
        if (h.reference_text) lastReadAt.set(h.reference_text, h.created_at);
      });

      // 2. 해당 레벨 근방(±0.5)과 난이도 밴드가 겹치는 지문 조회.
      // 지문마다 [ar_min, ar_max]가 0.4 폭으로 촘촘히(0.1 간격) 깔려 있어서, 선택 레벨
      // 정확히 그 점을 관통하는 지문만 보면(예전 조건) 같은 레벨로 등록된 지문 대부분이
      // 후보에서 빠지고 몇 개만 남아 반복 노출되는 문제가 있었다. ±0.5 범위로 겹치는
      // 지문 전체를 후보로 넓힌다.
      const LEVEL_RANGE = 0.5;
      const { data: allPassages } = await supabase
        .from("passages")
        .select("*")
        .gte("ar_max", lvl - LEVEL_RANGE)
        .lte("ar_min", lvl + LEVEL_RANGE);

      if (allPassages && allPassages.length > 0) {
        // 3. 이미 풀어본 지문(content 기준)을 제외한 신규 지문만 우선 후보로
        let candidates = allPassages.filter((p) => !lastReadAt.has(p.content));

        // 4. 안 풀어본 지문이 없으면(지문 고갈) 가장 오래전에 푼 지문(들)부터 재활용
        if (candidates.length === 0) {
          const sorted = [...allPassages].sort((a, b) =>
            (lastReadAt.get(a.content) || "").localeCompare(lastReadAt.get(b.content) || "")
          );
          const oldest = lastReadAt.get(sorted[0].content) || "";
          candidates = sorted.filter((p) => (lastReadAt.get(p.content) || "") === oldest);
        }

        // 5. 후보가 여럿이면 바로 직전에 낸 지문과 연달아 겹치지 않게 제외
        if (candidates.length > 1 && lastPassageId) {
          const withoutLast = candidates.filter((p) => p.id !== lastPassageId);
          if (withoutLast.length > 0) candidates = withoutLast;
        }

        // 6. 최종 후보 중 1개 랜덤 추출
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        setPassage(random);
        setLastPassageId(random.id);
      }
    };

    loadPassage();
  }, [selectedLevel, user?.id, passageReloadKey]);

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
      readingDurationSecRef.current = readingStartRef.current
        ? Math.max(1, (Date.now() - readingStartRef.current) / 1000)
        : null;
      const blob = new Blob(chunks, { type: "audio/webm" });
      setAudioBlob(blob);
      stream.getTracks().forEach((t) => t.stop());
      setPhase("recall");
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    readingStartRef.current = Date.now();

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
      headers: sessionData.session?.access_token
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : undefined,
      body: formData,
    });

    if (!pronunRes.ok) {
      const errData = await pronunRes.json().catch(() => ({}));
      alert(errData.error || "발음 분석 실패");
      return;
    }

    const pronunData = await pronunRes.json();
    // 서버 durationSec은 Azure가 인식한 발화 구간 길이만 합산해서, 단어 사이 의도적인
    // 정적/쉬는 시간이 통째로 빠져 WPM이 부풀려진다. 녹음 시작~종료 실제 경과 시간(클라이언트
    // wall-clock)을 우선 쓰고, 어떤 이유로든 못 구했을 때만 서버 값으로 대체한다.
    const durationSec = Math.max(1, readingDurationSecRef.current ?? pronunData.durationSec ?? 1);
    const recognizedText = pronunData.recognizedText || "";
    // wrongWords는 못다 읽은 뒷부분까지 포함된 전체 목록 — 점수(WPM/커버리지/정확도) 계산에는
    // 이 값을 그대로 써야 안 읽은 만큼 정확히 감점된다. missedWords는 "실제로 시도했지만 놓친
    // 단어"만 담긴 화면 표시용 목록 — 안 읽은 뒷부분이 통째로 "놓친 단어"로 뜨는 문제 방지.
    const wrongWords = pronunData.wrongWords || [];
    const missedWords = pronunData.missedWords || [];
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
    // 지문 자체의 난이도(ar_min/ar_max)가 없는 예외 케이스 방어: 선택한 목표 레벨 ±0.5로 대체
    const fallbackCenter = selectedLevel ? parseFloat(selectedLevel) : 1.0;
    const arMin = passage.ar_min ?? fallbackCenter - 0.5;
    const arMax = passage.ar_max ?? fallbackCenter + 0.5;

    const { finalAR, level: readingLevel } = calculateFinalAR(arMin, arMax, wpm, accuracy, comprehensionScore);

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

    const { data: insertedResult } = await supabase
      .from("reading_results")
      .insert([
        {
          user_id: currentUser.id,
          profile_id: profileId,
          student_id: profile?.student_id,
          wpm: safeWpm,
          accuracy: safeAccuracy,
          comprehension: comprehensionScore,
          final_ar: finalAR,
          reading_level: readingLevel,
          duration_sec: durationSec,
          spoken_words: correctWordCount,
          total_words: originalWordCount,
          coverage: readingCoverage,
          recognized_text: recognizedText,
          reference_text: refText,
          bad_pronunciations: badPronunciations,
          wrong_words: missedWords,
          ai_score: compData.score ?? 0,
          ai_comment: compData.summary ?? "분석 결과 없음",
          recall_text: recallText,
        },
      ])
      .select()
      .single();

    // 보유 패키지 크레딧이 있으면 자동으로 프리미엄 리포트 잠금 해제 (없으면 조용히 스킵)
    if (insertedResult?.id && sessionData.session?.access_token) {
      fetch("/api/credits/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ resultId: insertedResult.id }),
      }).catch((err) => console.error("크레딧 자동 소진 실패:", err));
    }

    // currentLevel은 승급/강등 버튼을 눌러야만 갱신되고 레벨 선택 화면에서 직접 고른
    // selectedLevel과는 따로 놀아서(예: 처음부터 AR3을 선택해도 currentLevel은 AR1인 채로
    // 남음) 실제로 이번에 테스트한 레벨은 selectedLevel에서 바로 구한다.
    const testedLevel: "AR1" | "AR2" | "AR3" | "AR4" =
      selectedLevel === "4.0"
        ? "AR4"
        : selectedLevel === "3.0"
        ? "AR3"
        : selectedLevel === "2.0"
        ? "AR2"
        : "AR1";

    // 승급 판정: "독립" 판정 자체는 comprehension 70만 넘어도 뜨지만(AR 점수 계산용 완화 기준),
    // "다음 레벨 통째로 넘어가라"는 권유는 그보다 더 확실한 신호가 필요하다. comprehension이
    // 70~85 사이의 턱걸이 독립 판정(예: 75%)까지 승급을 권하면 성급하게 느껴질 수 있어서,
    // 승급 권유에는 comprehension 85 이상(더 확실한 이해)을 추가로 요구한다.
    const confidentlyIndependent = readingLevel === "independent" && comprehensionScore >= 85;
    let levelUp: "AR2" | "AR3" | "AR4" | null = null;
    if (confidentlyIndependent) {
      if (testedLevel === "AR1") levelUp = "AR2";
      else if (testedLevel === "AR2") levelUp = "AR3";
      else if (testedLevel === "AR3") levelUp = "AR4";
    }

    // 좌절(frustration) 판정 시 한 단계 낮은 레벨을 권장 (AR1은 최저 단계라 내려갈 곳이 없음)
    let levelDown: "AR1" | "AR2" | "AR3" | null = null;
    if (readingLevel === "frustration") {
      if (testedLevel === "AR4") levelDown = "AR3";
      else if (testedLevel === "AR3") levelDown = "AR2";
      else if (testedLevel === "AR2") levelDown = "AR1";
    }

    setRecallPhase("idle");
    setFinalResult({
      final_ar: finalAR,
      reading_level: readingLevel,
      levelDown,
      wpm: safeWpm,
      accuracy: safeAccuracy,
      pronunciationAccuracy,
      comprehensionScore,
      durationSec,
      spokenWordCount: correctWordCount,
      originalWordCount,
      readingCoverage,
      ai_comment: compData.summary,
      wrong_words: missedWords,
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
        {phase === "ready" && eligibility && !eligibility.allowed && (
          <div className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-orange-600 to-orange-500 px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-orange-100">
                <AlertCircle className="h-4 w-4" aria-hidden={true} />
                Reading Assessment
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl text-balance">
                지금은 테스트를 시작할 수 없어요
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-orange-50">{eligibility.reason}</p>
            </div>
          </div>
        )}

        {phase === "ready" && (!eligibility || eligibility.allowed) && (
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
              <div className={`grid gap-3 ${selectedLevel ? "" : "sm:grid-cols-4"}`}>
                {LEVEL_OPTIONS.filter((opt) => !selectedLevel || opt.value === selectedLevel).map((opt) => {
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

              {selectedLevel && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLevel(null);
                    setPassage(null);
                  }}
                  className="mt-3 text-sm font-medium text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline"
                >
                  다른 레벨 선택하기
                </button>
              )}

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
                  // 화면 진입 시점에 이미 확인해둔 값. 그 사이 다른 탭에서 테스트를 더
                  // 봤거나 자정을 넘긴 경우를 대비한 마지막 안전장치 — 최종 관문은
                  // 어차피 /api/pronun 쪽 서버 체크.
                  if (eligibility && !eligibility.allowed) {
                    alert(eligibility.reason || "지금은 테스트를 진행할 수 없습니다.");
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

                {finalResult && finalResult.levelUp === "AR4" && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="flex items-center gap-2 font-semibold text-amber-900">
                      <Rocket className="h-5 w-5" aria-hidden={true} />
                      매우 빠르고 정확하게 읽고 있습니다.
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-800">
                      이 테스트는 기본 수준 확인용입니다. AR 4.0 단계 테스트를 진행해 보세요.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setFinalResult(null);
                        setCountdown(7);
                        setSelectedLevel("4.0");
                        setPhase("ready");
                      }}
                      className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                    >
                      AR 4.0 테스트 하기
                    </button>
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

                {finalResult && finalResult.levelDown && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                    <p className="flex items-center gap-2 font-semibold text-rose-900">
                      <AlertCircle className="h-5 w-5" aria-hidden={true} />
                      이번 지문은 아이에게 조금 어려웠어요.
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-rose-800">
                      {finalResult.levelDown} 단계 테스트로 다시 도전해 보세요. 눈높이에 맞는 지문으로 자신감을 먼저 쌓는 게 좋아요.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setFinalResult(null);
                        setCountdown(7);
                        setSelectedLevel(LEVEL_TO_SELECT_VALUE[finalResult.levelDown as "AR1" | "AR2" | "AR3"]);
                        setPhase("ready");
                      }}
                      className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
                    >
                      {finalResult.levelDown} 테스트 하기
                    </button>
                  </div>
                )}

                {finalResult &&
                  finalResult.reading_level === "frustration" &&
                  !finalResult.levelDown && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                      <p className="flex items-center gap-2 font-semibold text-rose-900">
                        <AlertCircle className="h-5 w-5" aria-hidden={true} />
                        이번 지문은 아이에게 조금 어려웠어요.
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-rose-800">
                        같은 레벨의 다른 지문으로 다시 연습해 보세요. 반복하다 보면 자연스럽게 편해집니다.
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setFinalResult(null);
                          setCountdown(7);
                          setPassage(null);
                          setPassageReloadKey((k) => k + 1);
                          setPhase("ready");
                        }}
                        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
                      >
                        같은 레벨로 다시 도전하기
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