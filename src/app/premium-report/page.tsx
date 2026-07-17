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
// 3. HOME-PRACTICE ROADMAP GENERATOR (V1.1)
// ==========================================
type RoadmapTask = {
  week: string;
  title: string;
  desc: string;
};

function generateDynamicRoadmap(ar: number, wpm: number, accuracy: number, readerType: string): RoadmapTask[] {
  if (accuracy < 90) {
    return [
      {
        week: "Week 1",
        title: "같은 책을 2번 읽기",
        desc: "한 번 읽어서 단어 의미가 친숙해진 상태에서 다시 정독하며 누락된 단어와 글자를 꼼꼼히 확인합니다."
      },
      {
        week: "Week 2",
        title: "소리 내어 천천히 정독하기",
        desc: "조금 느린 속도라도 괜찮으니 마침표와 단어의 끝맺음까지 눈으로 짚으며 소리 내어 꼼꼼히 읽습니다."
      },
      {
        week: "Week 3",
        title: "문장 끊지 않고 읽기 연습",
        desc: "한 문장을 중간에 멈추거나 더듬거리지 않고, 하나의 온전한 흐름으로 끝까지 연결하여 발화해 봅니다."
      },
      {
        week: "Week 4",
        title: "새 책보다 복습하기",
        desc: "지난 3주간 다루었던 친숙한 텍스트로 돌아와 마지막 점검을 하며 독서 자신감과 성공 경험을 채워갑니다."
      }
    ];
  }

  if (wpm < 85) {
    return [
      {
        week: "Week 1",
        title: "원어민 가이드 리스닝 앤 리드",
        desc: "쉬운 레벨의 원서를 골라 가이드 오디오를 귀로 들으며 시선과 입이 그 템포를 자연스럽게 쫓아가도록 합니다."
      },
      {
        week: "Week 2",
        title: "손가락으로 글자 밀며 읽기",
        desc: "머뭇거리는 시선 지체를 없애기 위해 손가락이나 펜 끝으로 단어 흐름을 가볍게 리드하며 독서 속도를 높입니다."
      },
      {
        week: "Week 3",
        title: "아는 단어 즉각 발화 세션",
        desc: "눈에 자주 익은 단어(Sight Words)는 한 단어씩 쪼개 읽지 않고 통으로 바로 인지하며 자연스럽게 미끄러집니다."
      },
      {
        week: "Week 4",
        title: "읽은 내용 한 문장으로 말하기",
        desc: "낭독을 무사히 마친 후, 전체 흐름에서 가장 인상 깊었던 장면을 한국어나 한 문장의 영어로 자유롭게 이야기해 봅니다."
      }
    ];
  }

  return [
    {
      week: "Week 1",
      title: "같은 책을 2번 읽기",
      desc: "첫 독서 시 발견하지 못한 작은 서사 구조와 숨겨진 뉘앙스 표현들을 두 번째 정독 과정에서 완벽하게 흡수합니다."
    },
    {
      week: "Week 2",
      title: "문장 끊지 않고 읽기",
      desc: "구절 단위의 청킹(Chunking) 흐름을 타며 호흡을 놓치거나 인위적으로 분할하지 않고 한 호흡으로 완독합니다."
    },
    {
      week: "Week 3",
      title: "읽은 내용 한 문장으로 말하기",
      desc: "줄거리를 길게 늘어놓지 않고, 핵심 인물과 갈등 중심의 단 하나의 임팩트 있는 구문으로 가볍게 재진술해 봅니다."
    },
    {
      week: "Week 4",
      title: "새 책보다 익숙한 책 복습하기",
      desc: "이전 난이도의 책을 완벽히 유창하고 흐트러짐 없이 읽어내는 최종 시뮬레이션을 완료하며 최상의 리딩 템포를 확보합니다."
    }
  ];
}

// ==========================================
// 4. DYNAMIC STUDY METHOD GUIDE SYSTEM (V1.1)
// ==========================================
type TailoredMethod = {
  focus: string;
  objective: string;
  steps: string[];
  tips: string;
};

function generateTailoredMethod(ar: number, wpm: number, accuracy: number, readerType: string): TailoredMethod {
  if (accuracy < 90) {
    return {
      focus: "읽기 흐름과 정확성의 밸런스 매칭",
      objective: "대충 눈대중으로 넘기며 단어를 가볍게 추측하는 습관을 통제하고 인지 정확성 높이기",
      steps: [
        "처음 읽는 책은 반드시 손가락으로 단어 하나하나를 정밀하게 짚어가며 글자 경계를 인지하기",
        "소리 내어 정독할 때 오독이나 누락이 발생하면, 다그치지 말고 한 걸음 멈춘 뒤 차분히 다시 시작하기",
        "이미 읽은 비교적 친숙하고 쉬운 동화책 위주로 반복해서 편안하게 소리 내어 읽기 연습"
      ],
      tips: "지금은 서둘러 속도를 내거나 어려운 단어에 맞닥뜨리는 것보다, 천천히 한 문장을 처음부터 끝까지 완전하게 읽는 소중한 연습 과정이 필요합니다."
    };
  }

  if (wpm < 85) {
    return {
      focus: "자연스러운 리딩 플로우와 자신감 회복",
      objective: "해독 정확성을 탄탄히 고수한 상태에서 머뭇거림을 줄이고 자연스러운 가속 패턴 장착하기",
      steps: [
        "원어민 보이스 가이드가 있는 쉬운 레벨의 낭독 음성을 먼저 충분히 귀로 들으며 템포 체감하기",
        "실수를 두려워하지 않고, 한두 단어 모르는 표현이 지나가더라도 호흡을 끝까지 이어 완주해 보기",
        "시간을 정해두거나 조급하게 몰아붙이기보다 3~5줄 내외의 한 페이지 단락을 정성스레 끝맺기"
      ],
      tips: "단어를 읽는 데 주저함이 길어지는 편이므로, 자신에게 친숙하고 쉬운 단계의 레벨 원서를 지속 노출하여 성공 경험을 쌓아주는 것이 핵심입니다."
    };
  }

  return {
    focus: "독서 흐름 유지력과 정교한 문맥 이해",
    objective: "이미 구축된 안정적인 기틀 위에서 어휘 뉘앙스를 자연스럽게 소화하고 독서 성취감 극대화하기",
    steps: [
      "문장이 끝나는 마침표(.)에서는 충분히 여유롭게 쉬어 가고, 쉼표(,) 간격을 존중하며 낭독 템포 튜닝하기",
      "글자 위주의 독해 수준을 한 단계 더 뛰어넘어, 대화문 속 캐릭터에 어조와 감정을 자연스럽게 담아보기",
      "주차별로 정독을 마친 에피소드의 큰 줄거리를 머릿속으로 이미지화하며 한국어로 조근조근 나누기"
    ],
    tips: "현재 리스크 관리가 훌륭한 안정적 독자입니다. 섣불리 무리해서 어려운 책으로 다이렉트 도약하기보다는, 현재 독서 난이도에서 깊이를 다지는 활동을 적극 권장합니다."
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

  const [isMounted, setIsMounted] = useState(false);

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

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`${studentName}_프리미엄_리딩_종합_리포트.pdf`);
    } catch (error) {
      console.error('PDF 다운로드 에러:', error);
      alert('PDF 변환 도중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

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

  const wpm = Math.round(result.wpm || 0);
  const accuracy = Math.round(result.accuracy || 0);
  const comprehension = Math.round(result.comprehension || 0);
  const ar = Number(result.final_ar || 0).toFixed(1);

  const rawReaderType = (result.reader_type || "Developing Reader").trim();
  const theme = THEMES[rawReaderType] || DEFAULT_THEME;

  const stageInfo = getStageInfo(result.final_ar || 0, wpm);
  const dynamicRoadmap = generateDynamicRoadmap(result.final_ar || 0, wpm, accuracy, rawReaderType);

  const userAr = Number(result.final_ar || 0);
  const filteredRecommendations = books
    .filter((b) => b.ar_min <= userAr + 0.5 && b.ar_max >= userAr - 0.5)
    .slice(0, 3);

  const tailoredMethod = generateTailoredMethod(result.final_ar || 0, wpm, accuracy, rawReaderType);

  const getTodayFocus = () => {
    if (accuracy < 90) {
      return {
        title: "오늘의 Reading Focus: 정확도 향상과 꼼꼼한 어휘 마감",
        items: ["차분하고 정확하게 읽기", "문장의 끝까지 소리 내어 확인하기", "조급하지 않은 리스크 컨트롤 안착"]
      };
    }
    if (wpm < 85) {
      return {
        title: "오늘의 Reading Focus: 유창한 리딩 플로우와 자신감 고무",
        items: ["Reading Flow 유지하기", "중간 더듬거림 극복하기", "쉬운 책을 통해 리딩 템포 익히기"]
      };
    }
    return {
      title: "오늘의 Reading Focus: 정교한 어휘 소화 및 탄탄한 유창성 밸런스",
      items: ["Reading Confidence 배가시키기", "자연스러운 문장 호흡 고수하기", "다양한 표현의 정량 정독 확장"]
    };
  };
  const todayFocus = getTodayFocus();

  const getNextReadingGoal = () => {
    if (accuracy < 90) {
      return "읽기 속도는 자연스럽게 유지하면서, 글자 끝맺음과 정확도를 조금만 더 짚어가며 높여보세요.";
    }
    if (wpm < 85) {
      return "현재의 뛰어난 정확도는 확실하게 고수하면서, 주저하지 말고 물이 흐르듯 조금 더 연결해서 읽어보세요.";
    }
    return "현재의 훌륭한 속도와 완벽한 정확도를 조화롭게 유지하면서, 문장 사이의 마침표와 쉼표를 감각적으로 호흡하며 읽어보세요.";
  };
  const nextReadingGoal = getNextReadingGoal();

  const getBookReason = (idx: number) => {
    const reasons = [
      "현재 읽기 속도와 흐름을 방해하지 않는 매우 적절한 난이도의 도서입니다.",
      "문장을 무리하게 끊지 않고 자연스럽게 이어서 읽는 유창성 연습에 아주 좋은 단계입니다.",
      "익숙한 표현이 가득하여 반복적으로 낭독하며 자신감을 축적하기에 최적의 책입니다."
    ];
    return reasons[idx % reasons.length];
  };

  const getReadingCoachData = () => {
    if (accuracy < 90) {
      return {
        strength: "텍스트에 나타난 전체적인 서사 맥락을 읽어내려는 자기 주도적이고 긍정적인 몰입도가 돋보입니다.",
        focus: "눈이 가독 속도보다 먼저 앞서가며 단어의 미세한 문법 어미나 세부 인식을 대충 유추해 넘어가는 경향을 조율해야 합니다.",
        practice: "이번 주에는 새 책보다 이미 한 번 편하게 통독한 원서 중에서 3줄 내외의 페이지를 골라, 마침표까지 완전하게 소리 내어 찍어 읽도록 다정하게 피드백해 주시는 것을 권장합니다."
      };
    }
    if (wpm < 85) {
      return {
        strength: "문맥 속 단어 하나하나의 철자 형태를 틀림없이 파악해 내는 완성도 높고 빈틈없는 인지 집중력이 매우 훌륭합니다.",
        focus: "새롭거나 생소한 단어를 만났을 때 다음 문장으로 물 흐르듯 가볍게 통과하지 못하고, 지나치게 멈칫거리며 속도가 지체되는 편입니다.",
        practice: "아이에게 책 읽기 시간을 체크하며 몰아세우는 타이밍 훈련을 일절 금지하시고, 이미 내용을 완전히 숙지하고 있는 가장 좋아하는 원서를 라디오 음성처럼 술술 노래하듯 읽어보는 안도감 중심의 환경을 열어주세요."
      };
    }
    return {
      strength: "읽기 속도(WPM)와 해독 디코딩 안정성이 대단히 고른 밸런스로 연계되어 있어 막힘 없고 편안한 완성형 구어 리딩 흐름을 갖추고 있습니다.",
      focus: "단순히 기계적으로 글자를 통과해 읽는 패턴을 극복하고, 구두점(마침표, 쉼표)을 충분히 즐기며 대화문 속에 캐릭터의 감정과 연음 강세를 실어 입체감을 부여해 볼 단계입니다.",
      practice: "아이가 독립적으로 스스로 리딩하는 규칙적인 습관을 꾸준히 격려해 주시고, 다 읽고 난 후에는 '오늘 읽은 내용 중 가장 깜짝 놀랄 만한 재미난 장면이 뭐였어?'하고 가벼운 스피킹 대화로 독서 여정을 마무리해 보세요."
    };
  };
  const readingCoach = getReadingCoachData();

  const getLearningAdvice = () => {
    if (accuracy < 90) {
      return "현재 학습 수준 영역에서는 새로운 어려운 원서를 늘려나가는 무리한 접근보다, 현재 수월하게 이해할 수 있는 쉬운 책을 여러 차례 '반복해서 깊게 읽기(Repeated Reading)'를 수행하는 것이 실질적인 독서 정확성을 가장 빠르고 편안하게 안정시키는 비결입니다.";
    }
    if (wpm < 85) {
      return "지금 단계에서는 리딩 속도를 인위적으로 강요하는 질주 훈련보다, 아이가 충분한 정서적 자신감을 갖출 수 있도록 AR 수치를 한두 레벨 가볍게 낮추어 한결 부드럽고 수월하게 미끄러지듯 완독해 내는 연속적 성취 경험을 충분히 누리도록 이끌어주시는 것이 우선 과제입니다.";
    }
    return "현재 독서의 전반적인 지표 밸런스가 대단히 우수하고 안정적이므로, 현재의 정독 습관을 흔들림 없이 고수한 채 챕터 분량이 조금 더 긴 단계적 책이나 호흡이 긴 옴니버스 형태의 신선한 원서 스케일 업에 도전하셔도 아주 훌륭한 촉진제가 될 것입니다.";
  };
  const learningAdvice = getLearningAdvice();

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

        {/* ================= READING DNA SECTION (DOM 불일치 파괴 설계 차단) ================= */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <Gauge className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">실시간 종합 Reading DNA 지표</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
              label="Accuracy"
              displayValue={`${accuracy}%`}
              isMounted={isMounted}
            />
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