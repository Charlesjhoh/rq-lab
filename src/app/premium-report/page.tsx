"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { generateReadingCoach } from "@/lib/reading-coach-engine";
import {
  Sparkles,
  BookOpen,
  Check,
  AlertTriangle,
  Lightbulb,
  Compass,
  Zap,
  Bookmark,
  Calendar,
  Hourglass,
  Gauge,
  GraduationCap,
  MessageSquareQuote
} from "lucide-react";

// ==========================================
// 1. DYNAMIC THEME SYSTEM CONFIGURATION
// ==========================================
type ProfileTheme = {
  name: string;
  color: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  ringClass: string;
  desc: string;
};

const THEMES: Record<string, ProfileTheme> = {
  "Independent Reader": {
    name: "Independent Reader",
    color: "#3b82f6",
    textClass: "text-blue-600",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    ringClass: "ring-blue-500",
    desc: "혼자서도 주도적으로 독서 전략을 세우고 깊이 있는 의미 파악이 가능한 독립적인 독자입니다."
  },
  "Fast Reader": {
    name: "Fast Reader",
    color: "#f59e0b",
    textClass: "text-amber-600",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    ringClass: "ring-amber-500",
    desc: "빠른 템포로 텍스트를 인지하며 직독직해 속도가 뛰어난 효율 중심형 독자입니다."
  },
  "Careful Reader": {
    name: "Careful Reader",
    color: "#10b981",
    textClass: "text-emerald-600",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    ringClass: "ring-emerald-500",
    desc: "오독율이 매우 낮으며 디코딩 과정을 꼼꼼하게 다지는 정밀 탐구형 독자입니다."
  },
  "Guess Reader": {
    name: "Guess Reader",
    color: "#f43f5e",
    textClass: "text-rose-600",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    ringClass: "ring-rose-500",
    desc: "의미 유추 및 상황 파악 능력은 뛰어나나 맥락에 의존해 단어를 추측하며 읽는 직관형 독자입니다."
  },
  "Developing Reader": {
    name: "Developing Reader",
    color: "#a855f7",
    textClass: "text-purple-600",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-200",
    ringClass: "ring-purple-500",
    desc: "기초 문해 습득기를 지나 복합적인 스토리 라인과 어휘를 적극적으로 축적 중인 성장기 독자입니다."
  },
  "Fluent Reader": {
    name: "Fluent Reader",
    color: "#6366f1",
    textClass: "text-indigo-600",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
    ringClass: "ring-indigo-500",
    desc: "음독 정확성 및 구문 해석 속도감이 유기적인 조화를 이뤄 막힘 없는 흐름을 보이는 독자입니다."
  },
  "Expressive Reader": {
    name: "Expressive Reader",
    color: "#ec4899",
    textClass: "text-pink-600",
    bgClass: "bg-pink-50",
    borderClass: "border-pink-200",
    ringClass: "ring-pink-500",
    desc: "문장 구조에 대한 확실한 이해도를 바탕으로 어조와 감정을 자연스럽게 실어 표현하는 독자입니다."
  }
};

const DEFAULT_THEME: ProfileTheme = {
  name: "Developing Reader",
  color: "#a855f7",
  textClass: "text-purple-600",
  bgClass: "bg-purple-50",
  borderClass: "border-purple-200",
  ringClass: "ring-purple-500",
  desc: "기초 문해 습득기를 지나 복합적인 스토리 라인과 어휘를 적극적으로 축적 중인 성장기 독자입니다."
};

// ==========================================
// 2. GLOBAL BENCHMARK MAP SEGMENT
// ==========================================
type StageInfo = {
  stage: string;
  usGrade: string;
  atos: string;
  lexile: string;
};

function getStageInfo(ar: number, wpm: number): StageInfo {
  if (ar < 0.4) {
    return { stage: "Early Emergent", usGrade: "Kindergarten", atos: "0.2 - 0.3", lexile: "BR" };
  } else if (ar < 1.3) {
    return { stage: "Emergent Readers", usGrade: "Pre-Primer", atos: "0.5 - 1.2", lexile: "100L - 180L" };
  } else if (ar < 1.9) {
    return { stage: "Beginning Readers", usGrade: "Primer~G1", atos: "1.5 - 1.8", lexile: "200L - 250L" };
  } else if (ar < 2.7) {
    return { stage: "Transitional Readers", usGrade: "G1~G2", atos: "1.9 - 2.6", lexile: "280L - 380L" };
  } else if (ar < 3.9) {
    return { stage: "Developing Readers", usGrade: "G2~G3", atos: "2.8 - 3.8", lexile: "420L - 600L" };
  } else if (ar < 5.1) {
    return { stage: "Fluent Readers", usGrade: "G4~G5", atos: "4.0 - 5.0", lexile: "650L - 800L" };
  } else {
    return { stage: "Matured Readers", usGrade: "G5~G8+", atos: "5.5 - 8.0+", lexile: "830L - 1050L+" };
  }
}

// ==========================================
// 3. DYNAMIC ROADMAP GENERATOR
// ==========================================
type RoadmapTask = {
  week: string;
  title: string;
  desc: string;
};

function generateDynamicRoadmap(ar: number, wpm: number, accuracy: number, readerType: string): RoadmapTask[] {
  const normalizedType = readerType.trim();
  if (ar < 1.9) {
    return [
      {
        week: "Week 1",
        title: "Sight Word Tracking",
        desc: "파닉스 규칙 예외 단어(Sight Words) 인지 반응 반응 속도를 교정하여 초반 끊김 빈도 최소화"
      },
      {
        week: "Week 2",
        title: "Phonics Audio Sync",
        desc: "이중모음 및 이중자음 단어의 파열 및 음절 분해 연습을 집중 낭독 프로젝트를 통해 정교화"
      },
      {
        week: "Week 3",
        title: "Short Phrase Bridge",
        desc: "개별 글자 중심 읽기에서 탈피해, 손으로 짚으며 2~3단어 묶음 단위로 시선을 밀어주는 청킹 브릿지 개설"
      },
      {
        week: "Week 4",
        title: "Fluent Echo Reading",
        desc: "원어민 보이스 가이드 속도에 맞춰 한 문장씩 번갈아 따라 읽는 에코 낭독을 통해 정직한 흐름 학습"
      }
    ];
  }

  if (normalizedType === "Guess Reader" || accuracy < 85) {
    return [
      {
        week: "Week 1",
        title: "Suffix Precision Audit",
        desc: "단어 끝에 붙은 복수형 -s, 과거형 -ed, 분사 -ing 등 문법 어미를 스킵 없이 정확히 끝맺는 정밀화 훈련"
      },
      {
        week: "Week 2",
        title: "Slow-Down Calibration",
        desc: "평소 가독 속도에서 인위적으로 15% 감속하는 브레이크 훈련을 거치며 인지 누락과 맹점(Blindspot) 극복"
      },
      {
        week: "Week 3",
        title: "Core Keyword Highlights",
        desc: "단어 줄글 속에서 핵심 인물과 동작을 지시어 펜으로 매핑하며, 감각적 예측 읽기를 차단하는 정독 설계"
      },
      {
        week: "Week 4",
        title: "Analytical Retrospective Q&A",
        desc: "문맥의 느낌이 아닌 사실 기반 디테일 질문 5개에 답하며, 정확도 95% 이상 도달 목표 검증"
      }
    ];
  }

  if (wpm < 80 || normalizedType === "Careful Reader") {
    return [
      {
        week: "Week 1",
        title: "Sight Recall Booster",
        desc: "한눈에 바로 반응해야 하는 핵심 구어 단어들을 주저 없이 0.5초 이내 즉각 발화하도록 반사 훈련"
      },
      {
        week: "Week 2",
        title: "Pacing Flow Transition",
        desc: "단어의 정확성 강박에서 벗어나 모르는 단어가 나와도 호흡을 끊지 않고 다음 단어로 미끄러져 연결하기"
      },
      {
        week: "Week 3",
        title: "Timed Sprint Reading",
        desc: "이미 흐름을 정복한 쉬운 난이도의 원서(AR -1.0 단계)로 모래시계 타이머 기준 유창성 스피드 끌어올리기"
      },
      {
        week: "Week 4",
        title: "Phrase Expansion Sweep",
        desc: "1회 안구 고정 시야 범위를 기존 1단어에서 3단어 청크(Chunk)로 확대하여 막힘 없는 연속 발화 도약"
      }
    ];
  }

  if (normalizedType === "Fast Reader") {
    return [
      {
        week: "Week 1",
        title: "Punctuation Intermission",
        desc: "마침표(.)에서 무조건 2초, 쉼표(,)에서 1초 동안 인위적으로 숨을 완전히 고르는 음독 템포 세션"
      },
      {
        week: "Week 2",
        title: "Prosody Intonation Focus",
        desc: "한 문장 내 모든 단어를 같은 속도로 질주하는 대신, 사건 강세와 강조하고 싶은 정보 구문에 강약 배합하기"
      },
      {
        week: "Week 3",
        title: "Fact-Check Reading Card",
        desc: "과속으로 인해 발생하는 디테일 이해 결손을 차단하기 위해 단락별 문장의 정확한 행간 검수 진행"
      },
      {
        week: "Week 4",
        title: "Balanced Target Pace",
        desc: "속도 가이드라인과 95% 이상의 인지 밸런스를 균형 있게 융합하여 흐트러짐 없는 탄탄한 리딩 페이스 안착"
      }
    ];
  }

  return [
    {
      week: "Week 1",
      title: "Complex Clause Mapping",
      desc: "수식어가 꼬리를 물거나 관계대명사가 포함된 긴 복합 장문의 구조를 중간 이탈 없이 정교하게 매핑하기"
    },
    {
      week: "Week 2",
      title: "Nuanced Vocabulary Bridge",
      desc: "단순 직역이 아닌 문학 소설 속 다의어의 미세한 문맥적 뉘앙스와 캐릭터의 심리 톤앤매너 추론 독서"
    },
    {
      week: "Week 3",
      title: "Rhetorical Reading Flow",
      desc: "글 속의 비유법과 어조의 정서를 고스란히 살려 읽는 프로소디(Prosody) 완성형 고급 낭독 구현"
    },
    {
      week: "Week 4",
      title: "Analytical Audio Log",
      desc: "스토리를 비판적 시각에서 정리하고, 인과관계를 포함해 단 5줄로 구조화하여 구두 요약본 녹음 완료"
    }
  ];
}

// ==========================================
// 4. DYNAMIC STUDY METHOD GUIDE SYSTEM
// ==========================================
type TailoredMethod = {
  focus: string;
  objective: string;
  steps: string[];
  tips: string;
};

function generateTailoredMethod(ar: number, wpm: number, accuracy: number, readerType: string): TailoredMethod {
  const normalizedType = readerType.trim();
  if (ar < 1.9) {
    return {
      focus: "음가 해독 강화 및 기초 청킹 (Phonics & Decodes)",
      objective: "단어 소리와 철자의 연결 정확성을 높이고 무의식적 시각 스킵 방지",
      steps: [
        "쉬운 리더스북 문장을 읽을 때 모르는 단어는 손가락 끝이나 눈으로 짚으며 파닉스 끊어 읽기",
        "소리 내어 읽기(음독)를 원어민 오디오북 가이드에 맞춰 문장 단위로 천천히 에코 리딩 수행",
        "단기 목표로 다 빈출 단어인 Sight Words 카드 플래시 암기 훈련을 주 3회 병행"
      ],
      tips: "속도(WPM)는 신경 쓰지 않고 단 하나의 오독도 스스로 정정하도록 격려하는 정적 피드백이 효과적입니다."
    };
  }

  if (normalizedType === "Guess Reader" || accuracy < 85) {
    return {
      focus: "의도적 템포 다운 및 어미 결합 감수 정독 (Precision Study)",
      objective: "눈이 뇌보다 먼저 가 흐름을 추측해 읽는 습관을 정밀 제어하여 정확성 95% 장착",
      steps: [
        "모든 영어 오독의 80%를 차지하는 복합 어미(s, ed, ing)를 과장되게 소리 내어 찍어 읽기",
        "현재 정상 인지 템포에서 인위적으로 15% 감속하여 낭독하는 디셀러레이터 미션 수행",
        "질문자가 주 단락을 요약하도록 지시하고 책 속에 언급된 구체적인 키워드를 역추적하여 검증"
      ],
      tips: "맥락을 짚는 임기응변 능력이 뛰어난 아이이므로 단어에 숨겨진 철자 디테일을 마주하도록 감속이 절대적입니다."
    };
  }

  if (wpm < 80 || normalizedType === "Careful Reader") {
    return {
      focus: "반사 인지 반응 및 유창성 가속 트랜지션 (Fluency Acceleration)",
      objective: "머릿속 한국어 번역 회로를 우회하고 영어 청크 자체를 즉각 시각 뇌로 통과시키기",
      steps: [
        "이미 정독이 끝난 쉬운 레벨(AR -0.8 단계) 원서 중 1페이지를 골라 제한 시간 타이머를 켜고 낭독",
        "2단어 혹은 3단어 이상으로 묶인 핵심 구(Phrase Chunk) 단위로 끊지 않고 시선 넘기기",
        "정확도에 지나치게 얽매여 멈추지 않고, 모르는 단어도 문장의 흐름대로 스치며 완주하는 연습"
      ],
      tips: "조심성이 강하고 완벽을 기하는 편이므로 '일부러 실수하며 빠르게 흐름 타기' 경험을 반복 제공해야 합니다."
    };
  }

  if (normalizedType === "Fast Reader") {
    return {
      focus: "구두점 인토네이션 통제 및 디테일 정독 (Intonation & Depth Reading)",
      objective: "과속으로 인해 정보 분실이 없도록 적절한 퍼즈(Pause) 감각 및 스토리 정독 매핑",
      steps: [
        "마침표(.)에서는 마음속으로 2초, 쉼표(,)에서는 1초를 세며 호흡을 제어하는 리딩 세션 정례화",
        "등장인물 간 대화문의 감정선과 스토리 변화에 맞춰 의도적인 억양과 구문 강세를 부여하는 프로소디 빌드업",
        "각 챕터를 끝낼 때마다 육하원칙을 중심으로 한 짧은 구두 Q&A로 핵심 세부 정보 누락 검사"
      ],
      tips: "엔진이 강력하고 속도가 좋은 아이이므로 브레이크(구두점 규칙)를 정밀하게 세팅해 유체 이탈 리딩을 방지합니다."
    };
  }

  return {
    focus: "다차원 구문 구조 맵핑 및 비판적 요약 기술 (Analytical Context)",
    objective: "문학적 디테일 파악과 숨겨진 다의어의 어조 정서 추론 및 분석적 스피칭 연계",
    steps: [
      "관계대명사, 긴 수식어구가 붙은 3줄 이상의 장문(Complex Sentence)을 구문 변형 없이 매끄럽게 통과하기",
      "문장에 쓰인 다의어들이 고전 소설 내 감정과 뉘앙스에 따라 어떻게 다른 느낌을 주는지 단어 노트 작성",
      "전체 챕터를 독파한 후 핵심 갈등과 본인의 관점을 5문장의 영어 오디오 요약본으로 녹음해 제출"
    ],
    tips: "이미 기본 역량이 탁월한 독자이므로 텍스트를 단순 수동 습득하는 것에서 나아가 비판적 의견을 표출하도록 이끕니다."
  };
}

// ==========================================
// 5. COLOR SCALE FOR CIRCULAR GAUGE
// ==========================================
function getDynamicGaugeColor(percentage: number): string {
  if (percentage < 35) return "#ef4444";
  if (percentage < 55) return "#f97316";
  if (percentage < 75) return "#eab308";
  if (percentage < 90) return "#10b981";
  return "#3b82f6";
}

// ==========================================
// 6. SVG CIRCULAR GAUGE COMPONENT (12시 방향 시계방향 애니메이션 빌드)
// ==========================================
type CircularGaugeProps = {
  percentage: number;
  size?: number;
  stroke?: number;
  color: string;
  label: string;
  displayValue: string;
};

function CircularGauge({
  percentage,
  size = 135,
  stroke = 11,
  color,
  label,
  displayValue
}: CircularGaugeProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // 마운트 시점에 차오르는 애니메이션을 구동하기 위한 전용 상태 제어
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    // 프레임 인지 단위로 0에서부터 실제 percentage까지 부드럽게 스위칭되도록 연출
    const animationFrame = requestAnimationFrame(() => {
      setAnimatedPercent(Math.min(Math.max(percentage, 0), 100));
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [percentage]);

  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <span className="text-[10px] font-bold text-slate-400 mb-4 tracking-wider uppercase z-10">
        {label}
      </span>
      <div className="relative" style={{ width: size, height: size }}>
        {/* -rotate-90: 12시 방향(북쪽)으로 90도 좌회전하여 시작점 고정
          origin-center: 회전 축의 기준점을 SVG 캔버스 한가운데로 격리
        */}
        <svg 
          width={size} 
          height={size} 
          className="-rotate-90 origin-center transition-transform duration-500 group-hover:scale-105"
        >
          {/* 회색 배경 가이드 라인 원 */}
          <circle 
            cx={size / 2} 
            cy={size / 2} 
            r={radius} 
            fill="none" 
            stroke="#f1f5f9" 
            strokeWidth={stroke} 
          />
          {/* 컬러 게이지 라인 원 (transition-all duration-1000 ease-out 기법 적용) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* 원형 한가운데에 점수 텍스트 완벽 수직/수평 중앙 배치 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-slate-800 tracking-tight">
            {displayValue}
          </span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. TIME CONVERSION UTILS
// ==========================================
function getReadingTime(book: any, userWpm: number) {
  const wpm = userWpm || 100;
  const wordCount = book?.word_count || 1000;
  return Math.max(1, Math.round(wordCount / wpm));
}

// ==========================================
// 8. CORE RENDERING ENGINE
// ==========================================
function ClientPart() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const resultId = searchParams.get("result_id");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (resultId) {
          const { data: resultData } = await supabase
            .from("reading_results")
            .select("*")
            .eq("id", resultId)
            .single();
          if (resultData) setResult(resultData);
        }

        const { data: booksData } = await supabase.from("books").select("*");
        if (booksData) setBooks(booksData);
      } catch (error) {
        console.error("비동기 수집 처리 도중 가드 브레이크 인지:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [resultId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-900 border-t-transparent mb-4" />
        <p className="text-sm font-semibold text-slate-500 tracking-tight">AI가 고해상도 프리미엄 리포트를 연동 중입니다...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl max-w-sm">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800 mb-1">리포트 유실 에러</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            유효하지 않은 고유 ID이거나 매칭 레코드를 로드해오지 못했습니다. 다시 시도해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // Formatting Real Values
  const wpm = Math.round(result.wpm || 0);
  const accuracy = Math.round(result.accuracy || 0);
  const comprehension = Math.round(result.comprehension || 0);
  const ar = Number(result.final_ar || 0).toFixed(1);

  // =======================================================
  // ⭐️ 핵심 수정 포인트: 공백 및 대소문자 예외 처리 가드 추가 ⭐️
  // =======================================================
  const rawReaderType = (result.reader_type || "Developing Reader").trim();
  const theme = THEMES[rawReaderType] || DEFAULT_THEME;

  const stageInfo = getStageInfo(result.final_ar || 0, wpm);

  const coach = generateReadingCoach({
    ar: result.final_ar ?? 0,
    wpm: result.wpm ?? 0,
    accuracy: result.accuracy ?? 0,
    comprehension: result.comprehension ?? 0
  });

  const dynamicRoadmap = generateDynamicRoadmap(result.final_ar || 0, wpm, accuracy, rawReaderType);

  const userAr = Number(result.final_ar || 0);
  const filteredRecommendations = books
    .filter((b) => b.ar_min <= userAr + 0.5 && b.ar_max >= userAr - 0.5)
    .slice(0, 3);

  const tailoredMethod = generateTailoredMethod(result.final_ar || 0, wpm, accuracy, rawReaderType);

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-900 antialiased">
      <div className="max-w-4xl mx-auto space-y-8">

{/* ================= HERO SECTION (FULLY DYNAMIZED) ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 sm:opacity-10 pointer-events-none">
            <Sparkles className="w-48 h-48 text-slate-950" />
          </div>
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              AI Reading Diagnosis
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                {result?.student_name ? `${result.student_name}의 리딩 아이덴티티` : "나의 맞춤형 리딩 분석"}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                {/* ⭐️ 하단 문구와 동일한 메커니즘으로 theme.bgClass, theme.textClass, theme.name이 실시간 연동됩니다 ⭐️ */}
                <span className={`inline-block text-lg font-black px-4 py-1.5 rounded-xl border transition-all duration-300 ${theme.bgClass} ${theme.textClass} ${theme.borderClass}`}>
                  {stageInfo.stage}
                </span>
              </div>
            </div>

            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              {theme.desc} {result?.student_name || "학생"}의 발음 세밀 분석과 흐름 유지력 매핑 결과, 공인 기준{" "}
              <span className={`font-black ${theme.textClass} underline decoration-2 underline-offset-4`}>
                {stageInfo.stage}
              </span>{" "}
              유형에 매치되었습니다.
            </p>
          </div>
        </section>

        {/* ================= GLOBAL BENCHMARK SECTION ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <Compass className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">글로벌 읽기 발달 기준 매핑</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">Readers' Stage</span>
              <span className={`text-base font-black ${theme.textClass} tracking-tight`}>{stageInfo.stage}</span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">US Grade Level</span>
              <span className="text-base font-black text-slate-800 tracking-tight">{stageInfo.usGrade}</span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">Estimated ATOS</span>
              <span className="text-base font-black text-slate-800 tracking-tight">{stageInfo.atos}</span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">Lexile Measure</span>
              <span className="text-base font-black text-slate-800 tracking-tight">{stageInfo.lexile}</span>
            </div>
          </div>
        </section>

        {/* ================= READING DNA SECTION ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">실시간 종합 Reading DNA 지표</h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              12시 방향 기준 시계방향 차오름 그래프
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <CircularGauge
              percentage={Math.min((wpm / 180) * 100, 100)}
              color={getDynamicGaugeColor(Math.min((wpm / 180) * 100, 100))}
              label="Reading Speed"
              displayValue={`${wpm} WPM`}
            />
            <CircularGauge
              percentage={accuracy}
              color={getDynamicGaugeColor(accuracy)}
              label="Accuracy"
              displayValue={`${accuracy}%`}
            />
            <CircularGauge
              percentage={comprehension}
              color={getDynamicGaugeColor(comprehension)}
              label="Comprehension"
              displayValue={`${comprehension}%`}
            />
            <CircularGauge
              percentage={Math.min((Number(ar) / 6) * 100, 100)}
              color={getDynamicGaugeColor(Math.min((Number(ar) / 6) * 100, 100))}
              label="Estimated AR Level"
              displayValue={`AR ${ar}`}
            />
          </div>
        </section>

        {/* ================= AI DIAGNOSIS SECTION ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-2.5 mb-8">
            <Bookmark className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">AI 다차원 읽기 진단 소견</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-2xl p-6 space-y-4 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">강점 (Strengths)</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {coach.feedback?.strength || "안정적인 문맥 추론력과 정확도 높은 음독 밸런스를 확보하고 있으며, 단어 경계에서의 망설임이 현저히 적습니다."}
              </p>
            </div>

            <div className="bg-rose-50/30 border border-rose-100/50 rounded-2xl p-6 space-y-4 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-500">
                  <AlertTriangle className="w-4 h-4 stroke-[2]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">취약점 (Challenges)</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {coach.feedback?.weakness || "음가 단위 정밀도가 무너지면 뒤쪽 철자 생략 경향이 포착되며, 스피드를 주체하지 못할 시 정확도 저하가 발생합니다."}
              </p>
            </div>

            <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-6 space-y-4 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Lightbulb className="w-4 h-4 stroke-[2]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">솔루션 가이드</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {coach.feedback?.actionPlan || "약 2주간 빠른 정독 세션을 분할 배치하여 복합 모음과 음가 접미사의 누수를 막는 맞춤형 가이드를 실행하세요."}
              </p>
            </div>
          </div>
        </section>

        {/* ================= PERSONALIZED MISSION ROADMAP ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 relative overflow-hidden">
          <div className="flex items-center gap-2.5 mb-8">
            <Calendar className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">4주 정밀 Stage-Up 미션 로드맵 (AI 자녀 분석 맞춤형)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {dynamicRoadmap.map((task, index) => (
              <div key={index} className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-3 relative transition-colors hover:bg-white group">
                <span className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded bg-white border border-slate-200 block w-max transition-colors group-hover:bg-slate-900 group-hover:text-white ${index === 0 ? theme.textClass : "text-slate-400"}`}>
                  {task.week}
                </span>
                <h4 className="text-sm font-black text-slate-800 tracking-tight">{task.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{task.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= BOOK RECOMMENDATIONS & TAILORED METHODS ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">AI 맞춤 추천 도서 큐레이션 및 맞춤형 리딩 훈련 학습법</h2>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <GraduationCap className="w-3.5 h-3.5" />
              AR G{ar} 레벨 맞춤 Curation
            </div>
          </div>

          {filteredRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredRecommendations.map((book, idx) => {
                const readingTimeMin = getReadingTime(book, wpm);
                return (
                  <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 transition-colors flex flex-col justify-between space-y-5 group relative overflow-hidden">
                    
                    <div className="space-y-4">
                      {/* Integrated Action Study Guide replacing old image placeholders */}
                      <div className="w-full bg-slate-50 rounded-xl p-5 border border-slate-100/50 space-y-3 group-hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <GraduationCap className={`w-4 h-4 ${theme.textClass}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wide">Dynamic Study Method</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-800 leading-tight">
                          💡 이 책을 정복하기 위한 행동 정독법
                        </h5>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {tailoredMethod.steps[idx] || "본인의 연음 속도 타겟 구문을 확실히 읽어내는 단락 훈련을 실천하세요."}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Literature</span>
                        <h4 className="text-sm font-black text-slate-800 line-clamp-1 group-hover:text-slate-950">{book.title}</h4>
                        <div className="flex items-center gap-2.5 mt-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${theme.bgClass} ${theme.textClass}`}>
                            AR {Number(book.ar_min || 0).toFixed(1)} - {Number(book.ar_max || 0).toFixed(1)}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                            <Hourglass className="w-3.5 h-3.5 text-slate-300" />
                            {readingTimeMin} Min read
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AI Selection Reason</span>
                      <ul className="space-y-1.5 text-xs text-slate-500">
                        <li className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">AR {ar} 단계에 상응하는 구문 길이와 단어 난이도</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">{theme.name}의 해독 밸런싱 최적화</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100">
              <p className="text-xs text-slate-400 leading-relaxed">
                현재 분석 레벨 궤도에 매치되는 도서 레코드를 데이터베이스에서 로드해 오지 못했습니다.
              </p>
            </div>
          )}

          {/* ================= METHODOLOGY BOARD ================= */}
          <div className="mt-8 bg-slate-50/50 border border-slate-150 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className={`w-5 h-5 ${theme.textClass}`} />
              <h3 className="text-sm font-bold text-slate-800">훈련 목적 및 AI 지침 요약</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="p-4 bg-white rounded-xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-400 text-[10px] uppercase">핵심 훈련 타겟</span>
                <p className="font-bold text-slate-800">{tailoredMethod.focus}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-400 text-[10px] uppercase">최종 지향 과업</span>
                <p className="font-bold text-slate-800">{tailoredMethod.objective}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4 italic">
              💡 <strong>리딩 코칭 가이드:</strong> {tailoredMethod.tips}
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}

export default function PremiumReadingReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-900 border-t-transparent mb-4" />
          <p className="text-sm font-semibold text-slate-500 tracking-tight">AI 리포트를 불러오는 중입니다...</p>
        </div>
      }
    >
      <ClientPart />
    </Suspense>
  );
}