"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import {
  Sparkles,
  BookOpen,
  Check,
  AlertTriangle,
  Compass,
  Zap,
  Bookmark,
  Calendar,
  Hourglass,
  Gauge,
  GraduationCap,
  MessageSquareQuote,
  TrendingUp,
  UserCheck,
  Heart,
  Download,
  MessageCircle
} from "lucide-react";
import {
  getCopyBucket,
  pickReadingCoach,
  pickLearningAdvice,
  pickRoadmap,
  pickTailoredMethod,
  pickTodayFocus,
  pickNextGoal,
  pickBookReason,
} from "@/lib/premium-report-copy";

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
// 6. SVG CIRCULAR GAUGE COMPONENT (Hydration Safe 보강)
// ==========================================
type CircularGaugeProps = {
  percentage: number;
  size?: number;
  stroke?: number;
  color: string;
  label: string;
  displayValue: string;
  isMounted: boolean;
};

function CircularGauge({
  percentage,
  size = 135,
  stroke = 14,
  color,
  label,
  displayValue,
  isMounted
}: CircularGaugeProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    if (isMounted) {
      const animationFrame = requestAnimationFrame(() => {
        setAnimatedPercent(Math.min(Math.max(percentage, 0), 100));
      });
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [percentage, isMounted]);

  const targetPercent = isMounted ? animatedPercent : 0;
  const strokeDashoffset = circumference - (targetPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
      <span className="text-[10px] font-bold text-slate-400 mb-4 tracking-wider uppercase z-10">
        {label}
      </span>
      <div className="relative animate-fadeIn" style={{ width: size, height: size }}>
        <svg 
          width={size} 
          height={size} 
          className="-rotate-90 origin-center transition-transform duration-500 group-hover:scale-105"
        >
          <circle 
            cx={size / 2} 
            cy={size / 2} 
            r={radius} 
            fill="none" 
            stroke="#f1f5f9" 
            strokeWidth={stroke} 
          />
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
// 7. READING TIME CALCULATOR
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

  const [studentName, setStudentName] = useState("학생");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [formattedDate, setFormattedDate] = useState("2026.07.16");
  const [remainingCredits, setRemainingCredits] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [isMounted, setIsMounted] = useState(false);

  // 결제 성공 화면에서 넘어온 경우(?unlock=1) 보유 크레딧이 있으면 버튼 클릭 없이
  // 바로 소진해서 리포트를 열어준다 — 방금 결제한 사람에게 한 번 더 클릭을 시키지 않기 위함.
  const autoUnlockRequested = searchParams.get("unlock") === "1";
  const [autoUnlockChecked, setAutoUnlockChecked] = useState(!autoUnlockRequested);
  const autoUnlockAttemptedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
          
          if (resultData) {
            setResult(resultData);
            
            if (resultData.profile_id) {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("student_name")
                .eq("id", resultData.profile_id)
                .single();
              
              if (profileData && profileData.student_name) {
                setStudentName(profileData.student_name);
              } else if (resultData.student_name || resultData.student) {
                setStudentName(resultData.student_name || resultData.student);
              }
            } else if (resultData.student_name || resultData.student) {
              setStudentName(resultData.student_name || resultData.student);
            }

            if (resultData.created_at) {
              const d = new Date(resultData.created_at);
              if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                setFormattedDate(`${yyyy}.${mm}.${dd}`);
              }
            } else {
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, "0");
              const dd = String(today.getDate()).padStart(2, "0");
              setFormattedDate(`${yyyy}.${mm}.${dd}`);
            }
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: packages } = await supabase
            .from("credit_packages")
            .select("remaining_credits")
            .eq("user_id", session.user.id)
            .gt("remaining_credits", 0)
            .gt("expires_at", new Date().toISOString());

          if (packages) {
            setRemainingCredits(packages.reduce((sum, p) => sum + p.remaining_credits, 0));
          }
        }

        const { data: booksData } = await supabase.from("books").select("*");
        if (booksData) setBooks(booksData);
      } catch (error) {
        console.error("비동기 데이터 패치 처리 도중 오류 발생:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [resultId]);

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    
    try {
      let html2canvas;
      try {
        html2canvas = (await import('html2canvas-pro')).default;
      } catch (error) {
        console.warn("html2canvas-pro 로드 실패, 기본 html2canvas로 우회합니다.", error);
        try {
          html2canvas = (await import('html2canvas')).default;
        } catch (fallbackError) {
          console.error("PDF 생성 라이브러리를 모두 불러올 수 없습니다.", fallbackError);
          alert("PDF 생성 모듈이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
          setIsExporting(false);
          return;
        }
      }

      let jsPDF;
      try {
        jsPDF = (await import('jspdf')).default;
      } catch (error) {
        console.error("jsPDF 로드 실패:", error);
        alert("PDF 변환 모듈을 불러오지 못했습니다.");
        setIsExporting(false);
        return;
      }

      const element = reportRef.current;
      if (!element) return;

      const clone = element.cloneNode(true) as HTMLDivElement;
      clone.style.width = '794px';
      clone.style.padding = '32px';
      clone.style.backgroundColor = '#ffffff'; 
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';

      const excludeElements = clone.querySelectorAll('.pdf-exclude, button, [data-pdf-exclude="true"]');
      excludeElements.forEach((el) => ((el as HTMLElement).style.display = 'none'));

      document.body.appendChild(clone);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(clone, {
        scale: 2,         
        useCORS: true,       
        backgroundColor: '#ffffff',
        logging: false,
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const safeStudentName = (studentName || "학생").replace(/[\\/:*?"<>|]/g, "").trim() || "학생";
      pdf.save(`${safeStudentName}_프리미엄_리딩_종합_리포트.pdf`);
    } catch (error) {
      console.error('PDF 다운로드 에러:', error);
      alert('PDF 변환 도중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUnlockWithCredit = async () => {
    if (!resultId) return;
    setUnlocking(true);
    setUnlockError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUnlockError("로그인이 필요합니다.");
        return;
      }

      const res = await fetch("/api/credits/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ resultId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUnlockError(data.error || "잠금 해제 중 오류가 발생했습니다.");
        return;
      }

      if (data.consumed) {
        setResult((prev: any) => ({ ...prev, is_unlocked: true, unlock_source: "package_credit" }));
        setRemainingCredits((prev) => Math.max(0, prev - 1));
      } else if (data.alreadyUnlocked) {
        setResult((prev: any) => ({ ...prev, is_unlocked: true }));
      } else {
        setUnlockError("사용 가능한 패키지 크레딧이 없습니다.");
      }
    } catch (err) {
      console.error(err);
      setUnlockError("잠금 해제 중 오류가 발생했습니다.");
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => {
    if (loading || autoUnlockChecked || autoUnlockAttemptedRef.current) return;

    if (!result || result.is_unlocked || remainingCredits <= 0) {
      setAutoUnlockChecked(true);
      return;
    }

    autoUnlockAttemptedRef.current = true;
    handleUnlockWithCredit().finally(() => setAutoUnlockChecked(true));
  }, [loading, result, remainingCredits, autoUnlockChecked]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-900 border-t-transparent mb-4" />
        <p className="text-sm font-semibold text-slate-500 tracking-tight">AI가 고해상도 프리미엄 리포트를 연동 중입니다...</p>
      </div>
    );
  }

  if (autoUnlockRequested && !autoUnlockChecked) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-900 border-t-transparent mb-4" />
        <p className="text-sm font-semibold text-slate-500 tracking-tight">결제가 확인되어 리포트를 자동으로 여는 중입니다...</p>
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

  if (!result.is_unlocked) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-slate-100 shadow-sm p-8 rounded-3xl max-w-sm w-full">
          <Sparkles className="h-9 w-9 text-indigo-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">프리미엄 리포트가 준비되었어요</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            AI 정밀 분석, 4주 로드맵, 맞춤 도서 추천까지<br />전체 리포트를 열람하려면 잠금 해제가 필요합니다.
          </p>

          {unlockError && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5 mb-4">
              {unlockError}
            </div>
          )}

          <div className="space-y-2.5">
            {remainingCredits > 0 && (
              <button
                onClick={handleUnlockWithCredit}
                disabled={unlocking}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {unlocking ? "처리 중..." : `보유 크레딧으로 보기 (잔여 ${remainingCredits}회)`}
              </button>
            )}
            <a
              href={`/checkout?type=single&resultId=${resultId}`}
              className="block w-full py-3 px-4 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              ₩19,000에 잠금 해제
            </a>
            <a
              href={`/checkout?type=package&resultId=${resultId}`}
              className="block w-full py-3 px-4 rounded-xl text-xs font-semibold text-indigo-600 hover:underline"
            >
              월 2회 패키지로 구매하기 (₩35,000)
            </a>
          </div>
        </div>
      </div>
    );
  }

  const wpm = Math.round(result.wpm || 0);
  const accuracy = Math.round(result.accuracy || 0);
  const comprehension = Math.round(result.comprehension || 0);
  const ar = Number(result.final_ar || 0).toFixed(1);
  // pronunciation_accuracy는 2026-08-28에 컬럼이 생겨서, 그 이전에 치른 테스트 결과는
  // null이다 — 0점과 구분해야 하므로 존재 여부를 따로 판별한다.
  const pronunciationAccuracy =
    result.pronunciation_accuracy != null ? Math.round(result.pronunciation_accuracy) : null;

  const rawReaderType = (result.reader_type || "Developing Reader").trim();
  const theme = THEMES[rawReaderType] || DEFAULT_THEME;

  const stageInfo = getStageInfo(result.final_ar || 0, wpm);

  const userAr = Number(result.final_ar || 0);
  const filteredRecommendations = books
    .filter((b) => b.ar_min <= userAr + 0.5 && b.ar_max >= userAr - 0.5)
    .slice(0, 3);

  // resultId를 시드로 버킷 내 변형 문구를 결정적으로 선택 — 같은 리포트는 새로고침해도
  // 항상 같은 문구가 나오지만, 같은 버킷의 다른 학생끼리는 문구가 겹치지 않는다.
  const copySeed = String(result.id || resultId || "seed");
  const copyBucket = getCopyBucket(accuracy, wpm);

  const dynamicRoadmap = pickRoadmap(copySeed, copyBucket);
  const tailoredMethod = pickTailoredMethod(copySeed, copyBucket);
  const todayFocus = pickTodayFocus(copySeed, copyBucket);
  const nextReadingGoal = pickNextGoal(copySeed, copyBucket);
  const getBookReason = (idx: number) => pickBookReason(copySeed, idx);
  const readingCoach = pickReadingCoach(copySeed, copyBucket);
  const learningAdvice = pickLearningAdvice(copySeed, copyBucket);

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-900 antialiased">
      <div 
        ref={reportRef} 
        className="max-w-[794px] mx-auto space-y-8 bg-slate-50/50 p-1 sm:p-2"
      >
        {/* ================= HEADER BRANDING & ACTION BUTTONS ================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-800">Premium Reading Report</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                Student : <strong className="text-slate-800">{studentName}</strong>
              </span>
              <span className="text-slate-200">|</span>
              <span>Date : {formattedDate}</span>
            </div>
          </div>

          <div data-pdf-exclude="true" className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  PDF 생성중..
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  📄 Download PDF
                </>
              )}
            </button>
            <a
              href="https://forms.gle/aCbBYSpcbx3Z2bbA7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              💬 Reading Coach 상담
            </a>
          </div>
        </div>

        {/* ================= HERO SECTION ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Sparkles className="w-48 h-48 text-slate-950" />
          </div>
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600">
              <UserCheck className="w-3.5 h-3.5" />
              참고 정보 (Reader Type): {stageInfo.stage}
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                {studentName ? `${studentName}의 프리미엄 리딩 종합 리포트` : "우리 아이 리딩 진단 분석 리포트"}
              </h1>
              
              <div className="mt-4 p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100/50 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                  <TrendingUp className="w-4.5 h-4.5" />
                  {todayFocus.title}
                </div>
                <div className="flex flex-wrap gap-2">
                  {todayFocus.items.map((item, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-indigo-200/60 text-indigo-700 shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed">
              {studentName}의 세밀 읽기 빅데이터(WPM, 정확도, 이해도) 기반 종합 분석 결과, 현재 공인 리딩 발달 레벨 궤도 중{" "}
              <span className={`font-black ${theme.textClass} underline decoration-2 underline-offset-4`}>
                {stageInfo.stage}
              </span>{" "}
              단계에 견고하게 연동되어 있음을 확인했습니다.
            </p>
          </div>
        </section>

        {/* ================= READING DNA SECTION (DOM 불일치 파괴 설계 차단) =================
             Hero 바로 다음으로 배치 — 애니메이션되는 원형 게이지가 리포트의 첫인상을
             결정하는 핵심 요소라, 스크롤 없이 바로 보이도록 위로 올렸다. */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <Gauge className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">실시간 종합 Reading DNA 지표</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <CircularGauge
              percentage={Math.min((wpm / 180) * 100, 100)}
              color={getDynamicGaugeColor(Math.min((wpm / 180) * 100, 100))}
              label="Reading Speed"
              displayValue={`${wpm} WPM`}
              isMounted={isMounted}
            />
            <CircularGauge
              percentage={accuracy}
              color={getDynamicGaugeColor(accuracy)}
              label="Reading Accuracy"
              displayValue={`${accuracy}%`}
              isMounted={isMounted}
            />
            {pronunciationAccuracy !== null ? (
              <CircularGauge
                percentage={pronunciationAccuracy}
                color={getDynamicGaugeColor(pronunciationAccuracy)}
                label="Pronunciation Accuracy"
                displayValue={`${pronunciationAccuracy}%`}
                isMounted={isMounted}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  Pronunciation Accuracy
                </span>
                <span className="text-xs text-slate-400 mt-2">이전 기록엔 없어요</span>
              </div>
            )}
            <CircularGauge
              percentage={comprehension}
              color={getDynamicGaugeColor(comprehension)}
              label="Comprehension"
              displayValue={`${comprehension}%`}
              isMounted={isMounted}
            />
            <CircularGauge
              percentage={Math.min((Number(ar) / 6) * 100, 100)}
              color={getDynamicGaugeColor(Math.min((Number(ar) / 6) * 100, 100))}
              label="Estimated AR Level"
              displayValue={`AR ${ar}`}
              isMounted={isMounted}
            />
          </div>
        </section>

        {/* ================= NEXT READING GOAL ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Zap className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Next Reading Goal (이번 주 목표)</h2>
          </div>
          <div className="p-5 bg-amber-50/30 border border-amber-100/40 rounded-2xl text-sm font-semibold text-amber-900/95 leading-relaxed">
            🎯 {nextReadingGoal}
          </div>
        </section>

        {/* ================= GLOBAL BENCHMARK SECTION ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <Compass className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">글로벌 공인 읽기 발달 기준 매핑</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">Readers' Stage</span>
              <span className={`text-sm font-black ${theme.textClass} tracking-tight`}>{stageInfo.stage}</span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">US Grade Level</span>
              <span className="text-sm font-black text-slate-800 tracking-tight">{stageInfo.usGrade}</span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">Estimated ATOS</span>
              <span className="text-sm font-black text-slate-800 tracking-tight">{stageInfo.atos}</span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-center transition-colors hover:bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-1">Lexile Measure</span>
              <span className="text-sm font-black text-slate-800 tracking-tight">{stageInfo.lexile}</span>
            </div>
          </div>
        </section>

        {/* ================= AI DIAGNOSIS SECTION ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-2.5 mb-8">
            <Bookmark className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">AI Reading Coach: 1:1 맞춤 피드백</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50/20 border border-emerald-100/50 rounded-2xl p-6 space-y-4 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">잘하고 있는 점</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {readingCoach.strength}
              </p>
            </div>

            <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-2xl p-6 space-y-4 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <TrendingUp className="w-4 h-4 stroke-[2]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">이번에 집중할 점</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {readingCoach.focus}
              </p>
            </div>

            <div className="bg-blue-50/20 border border-blue-100/50 rounded-2xl p-6 space-y-4 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Heart className="w-4 h-4 stroke-[2]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">집에서 이렇게 연습하세요</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {readingCoach.practice}
              </p>
            </div>
          </div>
        </section>

        {/* ================= PERSONALIZED MISSION ROADMAP ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 relative overflow-hidden">
          <div className="flex items-center gap-2.5 mb-8">
            <Calendar className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">집에서 실천하는 자녀 맞춤형 4주 로드맵</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {dynamicRoadmap.map((task, index) => (
              <div key={index} className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-3 relative transition-colors hover:bg-white group">
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-white border border-slate-200 block w-max transition-colors group-hover:bg-slate-900 group-hover:text-white ${index === 0 ? theme.textClass : "text-slate-400"}`}>
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
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">AI 데이터 기반 추천 원서 큐레이션</h2>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <GraduationCap className="w-3.5 h-3.5" />
              AR {ar} 레벨 맞춤 Curation
            </div>
          </div>

          {filteredRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredRecommendations.map((book, idx) => {
                const readingTimeMin = getReadingTime(book, wpm);
                return (
                  <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-250 hover:shadow-sm transition-all flex flex-col justify-between space-y-5 group relative overflow-hidden">
                    
                    <div className="space-y-4">
                      <div className="w-full bg-slate-50 rounded-xl p-5 border border-slate-100/50 space-y-3 group-hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <GraduationCap className={`w-4 h-4 ${theme.textClass}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wide">Daily Reading Training</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-800 leading-tight">
                          💡 이 책을 읽을 때 실천할 훈련
                        </h5>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {tailoredMethod.steps[idx] || "본인의 연음 속도 타겟 구문을 확실히 읽어내는 단락 훈련을 실천하세요."}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recommended Book</span>
                        <h4 className="text-sm font-black text-slate-800 line-clamp-1 group-hover:text-slate-950">{book.title}</h4>
                        <div className="flex items-center gap-2.5 mt-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${theme.bgClass} ${theme.textClass}`}>
                            AR {Number(book.ar_min || 0).toFixed(1)} - {Number(book.ar_max || 0).toFixed(1)}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                            <Hourglass className="w-3.5 h-3.5 text-slate-300" />
                            {readingTimeMin}분 분량
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">추천 드리는 이유</span>
                      <ul className="space-y-1.5 text-xs text-slate-500">
                        <li className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="leading-relaxed text-[11px]">{getBookReason(idx)}</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="leading-relaxed text-[11px]">현재 {ar} 수준보다 너무 어렵지 않아 성취감을 줍니다.</span>
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

        {/* ================= LEARNING ADVICE SECTION ================= */}
        <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 p-8 opacity-10 pointer-events-none">
            <GraduationCap className="w-48 h-48 text-white" />
          </div>
          <div className="space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold bg-white/10 text-white tracking-wide uppercase">
              <MessageSquareQuote className="w-3.5 h-3.5" />
              Learning Advice for Parents
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">아이의 학습 방향에 대한 AI 가이드 리포트</h2>
            <div className="border-t border-white/10 my-4" />
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              {learningAdvice}
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