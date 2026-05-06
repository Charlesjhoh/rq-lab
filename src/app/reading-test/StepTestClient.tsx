"use client";

import { useEffect, useRef, useState } from "react";
import { blobToPCM16kMono } from "@/app/components/utilsAudio";
import { supabase } from "@/lib/supabase-client";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

import { useSearchParams } from "next/navigation";

import { useRouter } from "next/navigation";

const [feedback, setFeedback] = useState({
  understood: "",
  helpful: "",
  paid: "",
  comment: "",
});
const [resultId, setResultId] = useState<string | null>(null);
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
  if (score >= 90) return 0;
  if (score >= 80) return 0.4;
  if (score >= 70) return 0.8;
  return 1.5;
}

function getBaseAR(wpm: number) {
  if (wpm <= 10) return 0.8;

  if (wpm <= 20) {
    return 0.8 + ((wpm - 10) / 10) * (1.0 - 0.8);
  }

  if (wpm <= 30) {
    return 1.0 + ((wpm - 20) / 10) * (1.2 - 1.0);
  }

  if (wpm <= 40) {
    return 1.2 + ((wpm - 30) / 10) * (1.5 - 1.2);
  }

  if (wpm <= 60) {
    return 1.5 + ((wpm - 40) / 20) * (1.8 - 1.5);
  }

  if (wpm <= 80) {
    return 1.8 + ((wpm - 60) / 20) * (2.0 - 1.8);
  }

  // 🔥 여기부터 기존 로직 연결
  if (wpm <= 120) {
    return 2.0 + ((wpm - 80) / 40) * 1.0; // → 3.0
  }

  if (wpm <= 150) {
    return 3.0 + ((wpm - 120) / 30) * 1.0; // → 4.0
  }

  if (wpm <= 180) {
    return 4.0 + ((wpm - 150) / 30) * 1.0; // → 5.0
  }

  return 5.0;
}

function getPronunciationPenalty(score: number) {
  if (score >= 85) return 0;
  if (score >= 70) return 0.3;
  if (score >= 60) return 0.6;
  return 1.0;
}

const getAccuracyPenalty = (accuracy: number) => {
  if (accuracy >= 85) return 0;
  if (accuracy >= 80) return 0.1;
  if (accuracy >= 75) return 0.2;
  return 0.3;
};



const getLevelColor = (score: number) => {
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#2563eb";
  if (score >= 60) return "#f59e0b";
  return "#dc2626";
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

export default function StepTestClient({ user }: { user: any }) {
  const searchParams = useSearchParams();
  const level = searchParams.get("level");
  const profileId = searchParams.get("profile_id");
  if (!profileId) {
  console.error("profileId 없음");
  return;
    }
 
  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [birth, setBirth] = useState(""); // YYYY-MM-DD

  const [isRecording, setIsRecording] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [recallPhase, setRecallPhase] = useState<RecallPhase>("idle");
  const [countdown, setCountdown] = useState(7);
  const [viewMode, setViewMode] = useState<"parent" | "teacher">("parent");
  const [currentLevel, setCurrentLevel] = useState<"AR1" | "AR2" | "AR3">("AR1");

  const [passage, setPassage] = useState<any>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recallBlob, setRecallBlob] = useState<Blob | null>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [bookGroups, setBookGroups] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recallRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recallChunksRef = useRef<Blob[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [lastPassageId, setLastPassageId] = useState<number | null>(null);
  /* ---------------- 지문 로딩 ---------------- */
  if (!user) {
    return <div>유저 없음</div>;
  }
useEffect(() => {
  if (!level) return;

  if (level === "ar2") {
    setSelectedLevel("2.0");
  } else if (level === "ar3") {
    setSelectedLevel("3.0");
  }
}, [level]);

useEffect(() => {
  const loadPassage = async () => {
    if (!selectedLevel) return;

      const level = parseFloat(selectedLevel);

      const { data } = await supabase
        .from("passages")
        .select("*")
       // .limit(10)
        .gte("ar_max", level)
        .lte("ar_min", level);



        if (data && data.length > 0) {
          let candidates = data;

          // 👉 이전 지문 제외
          if (lastPassageId) {
            candidates = data.filter((p) => p.id !== lastPassageId);
          }

          // 👉 후보가 없으면 (1개뿐일 때)
          if (candidates.length === 0) {
            candidates = data;
          }

          // 👉 랜덤 선택
          const random =
            candidates[Math.floor(Math.random() * candidates.length)];

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
  const chunks = audioChunksRef.current; // ✅ 이걸로 바꿔

  console.log("🔥 reading chunks:", chunks.length);

  if (chunks.length === 0) {
    alert("읽기 녹음 실패");
    return;
  }

  const blob = new Blob(chunks, { type: "audio/webm" });

  console.log("🔥 reading blob:", blob.size);

  setAudioBlob(blob); // ✅ 중요

  stream.getTracks().forEach((t) => t.stop());

  setPhase("recall"); // ✅ 다음 단계로 이동
};
    recorder.start(100);

 
    setStartTime(Date.now()); // ✅ 추가
    mediaRecorderRef.current = recorder;


    setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, 60000);
  };

  /* ---------------- 재진술 ---------------- */

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

    console.log("🧠 recall chunks:", chunks.length);

    if (chunks.length === 0) {
      alert("설명 녹음 실패");
      return;
    }

    const blob = new Blob(chunks, { type: "audio/webm" });

    console.log("🧠 recall blob:", blob.size);

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

  /* ---------------- 평가 ---------------- */

const BOOK_DB = [
  { series: "Biscuit", min: 0.7, max: 1.2 },
  { series: "Elephant and Piggie", min: 0.5, max: 1.4 },
  { series: "Fly Guy", min: 1.3, max: 2.1 },
  { series: "Pete the Cat", min: 1.2, max: 1.9 },
  { series: "Henry and Mudge", min: 2.1, max: 2.7 },
  { series: "Nate the Great", min: 2.0, max: 3.1 },
  { series: "Magic Tree House", min: 2.6, max: 3.5 },
  { series: "A to Z Mysteries", min: 3.2, max: 3.8 },
  { series: "My Weird School", min: 3.3, max: 4.0 },
  { series: "Captain Underpants", min: 4.3, max: 5.2 },
  { series: "Ramona", min: 4.2, max: 5.6 },
  { series: "Harry Potter", min: 5.5, max: 7.2 },
];

function getRecommendedBooks(ar: number) {
  return BOOK_DB
    .filter((b) => ar >= b.min - 0.3 && ar <= b.max + 0.3)
    .slice(0, 3);
}

function getBookGroups(ar: number) {
  const fit = BOOK_DB.filter(
    (b) => ar >= b.min && ar <= b.max
  ).slice(0, 2);

  const challenge = BOOK_DB.filter(
    (b) => ar > b.max && ar <= b.max + 0.5
  ).slice(0, 1);

  return { fit, challenge };
}

  const runAssessment = async (
    recallBlobParam: Blob,
    audioBlobParam: Blob | null
  ) => {
    if (!passage || !passage.content) {
      alert("지문이 없습니다");
      return;
    }

    if (!audioBlobParam) {
      alert("읽기 녹음이 없습니다");
      return;
    }

    if (!recallBlobParam) {
      alert("설명 녹음이 없습니다");
      return;
    }
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    router.push("/login");
    return;
  }

  if (!audioBlobParam || !recallBlobParam || !passage) {
    console.error("🔥 blob 문제", { audioBlobParam, recallBlobParam });
    return;
  }

  const refText = passage.content;

  // ---------------- 발음 평가 ----------------
  const pcmBytes = await blobToPCM16kMono(audioBlobParam);
  const formData = new FormData();
  const safeBuffer = new Uint8Array(pcmBytes);

  formData.append("audio", new Blob([safeBuffer]));
  formData.append("text", refText);
  formData.append("user_id", user.id);

  const pronunRes = await fetch("/api/pronun", {
    method: "POST",
    body: formData,
  });

  if (!pronunRes.ok) {
  alert("발음 분석 실패");
  return;
  }
 
  const pronunData = await pronunRes.json();

  const accuracy = pronunData.accuracy;
  const pronunciationAccuracy = pronunData.pronunciationAccuracy || 0;
  const durationSec = pronunData.durationSec;
  const recognizedText = pronunData.recognizedText || "";
  const originalWords = refText.trim().split(/\s+/);
  const spokenWordsArr = recognizedText.trim().split(/\s+/);

const spokenWordCount = Math.min(spokenWordsArr.length, originalWords.length);

  // 🔥 핵심 계산들
  const spokenText = pronunData.recognizedText || "";

  const spokenWords = spokenText.trim().split(/\s+/);





const aiRes = await fetch("/api/ai-comment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    wrongWords: pronunData.wrongWords,
    referenceText: refText,
    recognizedText: spokenText,
  }),
});

const aiData = await aiRes.json();
//const aiComment = aiData.comment || "";


const originalWordCount = refText.trim().split(/\s+/).length;
const readingCoverage = spokenWordCount / originalWordCount;
const wpm = (spokenWordCount / durationSec) * 60;
let compData;



// 3️⃣ fetch (여기서 처음 등장)
// 2️⃣ FormData 생성
// 1️⃣ PCM 변환
let recallPCM;
try {
  recallPCM = await blobToPCM16kMono(recallBlobParam);
} catch (e) {
  alert("음성 변환 실패");
  return;
}

const recallForm = new FormData();
const safePCM = new Uint8Array(recallPCM);

recallForm.append("audio", new Blob([safePCM]));
recallForm.append("text", refText);
recallForm.append("user_id", user.id);

recallForm.append("wpm", String(wpm));
recallForm.append("accuracy", String(accuracy));


const compRes = await fetch("/api/comprehension", {
  method: "POST",
  body: recallForm,
});

if (!compRes.ok) {
  alert("이해도 분석 실패");
  return;
}

// 4️⃣ text 받기
const text = await compRes.text();

// 5️⃣ JSON 파싱
try {
  compData = JSON.parse(text);
} catch (e) {
  console.error("❌ JSON parse 실패", text);

  // 👉 fallback 넣어
  compData = {
    score: 0,
    summary: "분석 결과를 불러오지 못했습니다.",
    good: [],
    bad: [],
  };
}
let comprehensionScore = compData.score || 0;

// 6️⃣ score 추출
if (compData.score === undefined) {
  alert("이해도 분석 실패");
  return;
}


// 7️⃣ AR 계산
const baseAR = getBaseAR(wpm);
console.log("spokenWordCount:", spokenWordCount, "baseAR:", baseAR, "accuracy:", accuracy, "comprehensionScore:", comprehensionScore);

let finalAR =
  baseAR -
  getAccuracyPenalty(accuracy) -
  getPronunciationPenalty(pronunciationAccuracy) -
  getComprehensionPenalty(comprehensionScore);
finalAR = Math.max(0.5, Math.min(5.0, finalAR));


// 🔥 레벨별 기준
let minCoverage = 0.3;

if (finalAR < 2) minCoverage = 0.2;
else if (finalAR < 3) minCoverage = 0.3;
else minCoverage = 0.4;

// 🔥 기존 조건 삭제하고 이걸로 교체
if (readingCoverage < minCoverage) {
  alert("읽기가 충분하지 않아 결과를 계산할 수 없습니다.");
  setPhase("ready");
  return;
}




  if (!durationSec || durationSec === 0) {
      alert("녹음 시간이 너무 짧습니다");
      return;
  }



  


if (
  pronunData.accuracy === undefined ||
  pronunData.durationSec === undefined
) {
  console.error("❌ 발음 평가 실패", pronunData);
  alert("발음 분석 실패");
  return;
}






setDiagnosis([compData.comment || ""]);

const compGood: string[] = []; // 아직 없음
const compBad: string[] = [];  // 아직 없음
const compSummary = compData.comment || "";
// 🔴 recall 텍스트
const recallText = compData.recallText || "";
const baseScore = compData.score || 0;


// 🔴 길이 기반 보정
const recallWordCount = recallText.trim().split(/\s+/).length;

let finalScore = baseScore;

if (recallWordCount < 5) {
  finalScore = 0;
} else if (recallWordCount < 10) {
  finalScore = baseScore * 0.5;
}

// 🔥 NaN 먼저 처리
if (isNaN(finalScore)) {
  finalScore = 0;
}

// 🔥 마지막에 한 번만 정리
comprehensionScore = Math.round(finalScore);


const safe = (v: number) => (isNaN(v) ? 0 : v);

const safeWpm = safe(wpm);
const safeAccuracy = safe(accuracy);



const recommendedBooks = getRecommendedBooks(finalAR);
setRecommended(recommendedBooks);
const groups = getBookGroups(finalAR);
setBookGroups(groups);

function generateFlags({
  accuracy,
  wpm,
  coverage,
}: {
  accuracy: number;
  wpm: number;
  coverage: number;
}) {
  const flags: string[] = [];

  if (coverage < 0.7) flags.push("중간 생략 가능성");
  if (accuracy < 75) flags.push("발음 정확도 낮음");
  if (wpm < 80) flags.push("속도 느림");

  return flags;
}

console.log("🔥 저장 데이터:", {
  ai_score: compData.score,
  ai_comment: compData.summary
});
const aiScore = compData.score ?? 0;
const aiComment = compData.summary ?? "분석 결과 없음";

const { data: profile, error } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .maybeSingle();

if (error) {
  console.error(error);
  return;
}

if (!profile) {
  console.error("profile 없음");
  return;
}

console.log("student_name:", profile.student_name);
  // ---------------- DB 저장 ----------------
await supabase.from("reading_results").insert([
  {
    user_id: user.id,
    profile_id: profileId,
    wpm: safeWpm,
    accuracy: safeAccuracy,
    comprehension: comprehensionScore,
    final_ar: finalAR,
    duration_sec: durationSec,
    spoken_words: spokenWordCount,
    total_words: originalWordCount,
    coverage: readingCoverage,
    recognized_text: spokenText,
    reference_text: refText,
    bad_pronunciations: pronunData.badPronunciations || [],
    wrong_words: pronunData.wrongWords || [],

    ai_score: aiScore,
    ai_comment: aiComment,
    recall_text: compData.recallText || "",
    comp_good: compData.good || [],
    comp_bad: compData.bad || [],
    comp_summary: compData.summary || "",

  },
]);
//  .select()
//  .single();

if (!profileId) {
  console.error("profileId 없음");
  return;
}
  setResultId(resultId);

let levelUp: "AR2" | "AR3" | null = null;

if (currentLevel === "AR1" && wpm >= 80 && accuracy >= 85) {
  levelUp = "AR2";
}

if (currentLevel === "AR2" && wpm >= 120 && accuracy >= 90) {
  levelUp = "AR3";
}

setRecallPhase("idle");

setFinalResult({
  baseAR,
  final_ar: finalAR,          // 🔥 이름 맞춰서
  wpm: safeWpm,
  accuracy: pronunData.accuracy, 
  pronunciationAccuracy: pronunData.pronunciationAccuracy, // (선택)
  comprehensionScore,
  durationSec,
  spokenWordCount,
  originalWordCount,
  readingCoverage,
  ai_comment: compData.summary,      // 🔥 여기 넣는다
  wrong_words: pronunData.wrongWords,   // 🔥 이거 추가
  badPronunciations: pronunData.badPronunciations, // 🔥 이거 추가
  levelUp, 
});

  setPhase("result");
};

  /* ---------------- UI ---------------- */
return (
  <div>
{phase === "ready" && (
  <div>
    <h2>레벨을 선택하세요</h2>

    <label>
      <input
        type="radio"
        name="level"
        value="1.0"
        checked={selectedLevel === "1.0"}
        onChange={(e) => {
          setPassage(null);
          setSelectedLevel(e.target.value);
        }}
      />
      AR 1.0
    </label>

    <label>
      <input
        type="radio"
        name="level"
        value="2.0"
        checked={selectedLevel === "2.0"}
        onChange={(e) => {
          setPassage(null);
          setSelectedLevel(e.target.value);
        }}
      />
      AR 2.0
    </label>

    <label>
      <input
        type="radio"
        name="level"
        value="3.0"
        checked={selectedLevel === "3.0"}
        onChange={(e) => {
          setPassage(null);
          setSelectedLevel(e.target.value);
        }}
      />
      AR 3.0
    </label>

    {/* 🔥 여기 추가 */}
    {selectedLevel && !passage && <p>지문 불러오는 중...</p>}



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
    >
      시작하기
    </button>
  </div>
)}



    {/* COUNTDOWN */}
    {phase === "countdown" && (
      <div>
        <h3>읽을 준비를 하세요</h3>
        <h1>{countdown}</h1>
        <blockquote>{passage.content}</blockquote>
      </div>
    )}

    {/* READING */}
    {phase === "reading" && (
      <div>
        <h3>지문을 읽으세요. 🔴 녹음 중입니다</h3>

        <button
          onClick={() => {
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          }}
        >
          ⏹️ 녹음 종료
        </button>

        <blockquote>{passage.content}</blockquote>
      </div>
    )}

    {/* RECALL */}
    {phase === "recall" && (
      <div>
        <h3>방금 읽은 내용을 설명하세요</h3>

        {recallPhase === "idle" && (
          <button onClick={startRecallRecording}>설명 시작</button>
        )}

        {recallPhase === "recording" && (
          <button onClick={() => recallRecorderRef.current?.stop()}>
            설명 마치기
          </button>
        )}

        {recallPhase === "recorded" && (
          <>
            <button onClick={startRecallRecording}>다시 녹음</button>
            <button onClick={() => submitRecall()}>제출하기</button>
          </>
        )}

        {recallPhase === "submitting" && <p>📊 AI 분석 중...</p>}
      </div>
    )}

    {/* RESULT */}
{phase === "result" && finalResult && (
  
  
  <div>
    <h3>📌 발음 / 이해 피드백</h3>
    
      <ul>

        {finalResult?.ai_comment ? (
          <p>{finalResult.ai_comment}</p>
        ) : (
          <p style={{ color: "#888" }}>분석 결과 없음</p>
        )}
      </ul>
        {finalResult?.wrong_words?.length > 0 && (
          <>
            <div>
                <h3>📘 읽기에서 놓친 단어</h3>
                <div>
                {finalResult.wrong_words.map((w: string, i: number) => (
                  <span key={i} style={{ marginRight: 8 }}>
                    {w}
                  </span>
                ))}
              </div>
            
            </div>
          </>
        )}


        {finalResult?.badPronunciations?.length > 0 && (
          <>
            <h3>🔊 발음이 어려운 단어</h3>
            <p>다음 단어는 발음 정확도가 낮았습니다.</p>

            <div>
              {finalResult.badPronunciations.slice(0, 5).map((w: string, i: number) => (
                <span key={i} style={{ marginRight: 8, color: "red" }}>
                  {w}
                </span>
              ))}
            </div>
          </>
        )}

        {finalResult?.wrong_words?.length === 0 &&
        finalResult?.badPronunciations?.length === 0 && (
          <div style={{ marginTop: 20, color: "green" }}>
            👍 읽기와 발음 모두 안정적입니다.
          </div>
        )}


      {finalResult && finalResult.levelUp === "AR3" && (
        <div style={{ padding: 16, background: "#fff7e6", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontWeight: 600 }}>
            🚀 매우 빠르고 정확하게 읽고 있습니다.
          </p>
          <p style={{ fontSize: 14 }}>
            이 테스트는 기본 수준 확인용입니다.  
            AR 3.0 단계 테스트를 진행해 보세요.
          </p>

            <button
              type="button"
              onClick={() => {
                setCurrentLevel("AR3");   // 🔥 추가
                setFinalResult(null);
                setCountdown(7);
                setSelectedLevel("3.0");
                setPhase("ready");
              }}
            >
            AR 3.0 테스트 하기
          </button>
        </div>
      )}
      
      {finalResult && finalResult.levelUp === "AR2" && (
        <div style={{ padding: 16, background: "#e6f7ff", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontWeight: 600 }}>
            📈 읽기 속도가 안정적으로 올라왔습니다.
          </p>
          <p style={{ fontSize: 14 }}>
            AR 2.0 단계 테스트로 넘어가세요.
          </p>

            <button
              type="button"
            onClick={() => {
              setCurrentLevel("AR2");   // 🔥 추가
              setFinalResult(null);
              setCountdown(7);
              setSelectedLevel("2.0");
              setPhase("ready");
            }}
            >
            AR 2.0 테스트 하기
          </button>
        </div>
      )}

    <h2>📊 리딩 진단 결과</h2>

    <h3>
      AR{" "}
        {!finalResult.levelUp && (
          <p>📘 AR: {finalResult.final_ar.toFixed(1)}</p>
        )}
    </h3>

    <p>읽기 속도: {finalResult?.wpm ? Math.round(finalResult.wpm) : "-"} WPM</p>
    <p>읽기 정확도: {finalResult.accuracy ?? "-"}%</p>
    <p>발음 정확도: {finalResult.pronunciationAccuracy ?? "-"}%</p>
    <p>이해도: {Math.round(finalResult.comprehensionScore)}%</p>

    <p>
      {generateParentComment(
        finalResult.wpm,
        finalResult.accuracy,
        finalResult.comprehensionScore
      )}
    </p>



  </div>


)}
<div style={{ marginTop: 30, padding: 20, background: "#f5f5f5" }}>
  <p><b>👉 10초 피드백</b></p>

  <p>1. 결과 이해되셨나요?</p>
  <select onChange={(e) => setFeedback({...feedback, understood: e.target.value})}>
    <option value="">선택</option>
    <option>매우 그렇다</option>
    <option>보통</option>
    <option>아니다</option>
  </select>

  <p>2. 도움이 되었나요?</p>
  <select onChange={(e) => setFeedback({...feedback, helpful: e.target.value})}>
    <option value="">선택</option>
    <option>매우 그렇다</option>
    <option>보통</option>
    <option>아니다</option>
  </select>

  <p>3. 유료라면 사용할 의향 있으신가요?</p>
  <select onChange={(e) => setFeedback({...feedback, paid: e.target.value})}>
    <option value="">선택</option>
    <option>있다</option>
    <option>고민</option>
    <option>없다</option>
  </select>

  <p>👉 가장 궁금한 점 1가지만 적어주세요</p>
  <textarea
    style={{ width: "100%", height: 80 }}
    onChange={(e) => setFeedback({...feedback, comment: e.target.value})}
  />

  <button
    style={{ marginTop: 10 }}
    onClick={async () => {
      console.log("피드백:", feedback);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다");
        return;
      }

      const { error } = await supabase.from("feedbacks").insert({
        user_id: user.id,
//        result_id: resultId,   // ⚠️ 이거 중요
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
  >
    제출
  </button>
</div>
  </div>
  
);
}