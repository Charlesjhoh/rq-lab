"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  BarChart3,
  Timer,
  Target,
  Brain,
  BookOpen,
  FileText,
  Sparkles,
  AlertTriangle,
  CircleCheck,
  CircleAlert,
  CircleDashed,
  Calendar,
  Mail,
  User,
  Wallet,
  Lock,
  LockOpen,
} from "lucide-react";

// 타입 선언
type Student = {
  id: string;
  student_id: string;
  student_name: string;
  parent_name: string;
  birth: string;
  email: string;
  role: string;
};

type ReadingResult = {
  id: string;
  user_id?: string;
  wpm: number;
  accuracy: number;
  comprehension: number;
  final_ar?: number;
  reading_level?: "frustration" | "instructional" | "independent" | null;
  created_at: string;
  reference_text?: string;
  recognized_text?: string;
  recall_text?: string;
  ai_comment?: string;
  duration_sec?: number;
  spoken_words?: number;
  total_words?: number;
  coverage?: number;
  flags?: string[];
  is_unlocked?: boolean;
  unlock_source?: string | null;
};

async function authedFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("로그인이 필요합니다.");

  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

export default function TeacherPage() {
  const router = useRouter();

  // 상태 관리
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [latestByProfileId, setLatestByProfileId] = useState<Record<string, ReadingResult | null>>({});
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [results, setResults] = useState<ReadingResult[]>([]);
  const [keyword, setKeyword] = useState("");
  const [credits, setCredits] = useState<{ remaining: number; nearestExpiry: string | null } | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<{ displayName: string | null; email: string | null; role: string } | null>(null);

  // 정적 페이지 프리렌더링 시 레이아웃 붕괴 및 경고를 원천 차단하기 위한 마운트 가드
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🔐 profiles 테이블의 role 검증 로직 적용
  useEffect(() => {
    const checkTeacherRole = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          alert("로그인이 필요합니다.");
          router.push("/login");
          return;
        }

        // profiles 테이블에서 로그인한 유저의 role을 바로 확인
        const { data: profileData, error: dbError } = await supabase
          .from("profiles")
          .select("role, display_name, email")
          .eq("id", user.id)
          .single();

        if (dbError || !profileData || !["teacher", "manager"].includes(profileData.role)) {
          alert("접근 권한이 없습니다. 선생님 계정으로 로그인해 주세요.");
          router.push("/");
          return;
        }

        setCurrentTeacher({
          displayName: profileData.display_name,
          email: profileData.email || user.email || null,
          role: profileData.role,
        });

        await Promise.all([loadStudents(), loadAllResults()]);
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    checkTeacherRole();
  }, [router]);

  // 데이터 로드: 1. 전체 학생 정보 로드
  // 💡 다른 유저의 profiles 행을 읽는 조회라 RLS(본인 행만 허용)를 우회할 수 없음 —
  // 서버에서 teacher/manager role을 재검증하는 /api/teacher/students를 통해 가져온다.
  const loadStudents = async () => {
    try {
      const res = await authedFetch("/api/teacher/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      } else {
        console.error("Error loading profiles:", await res.text());
      }
    } catch (err) {
      console.error("Error loading profiles:", err);
    }
  };

  // 데이터 로드: 2. 학생별 최신 리딩 결과 함께 로드
  // 💡 profiles<->reading_results 중첩 조인은 FK 관계 설정에 의존하고, student_id는
  // 시험 응시 시점에만 복사되는 값이라 비어있는 경우가 있어 매칭이 깨질 수 있었음.
  // 항상 채워지는 profiles.id <-> reading_results.user_id로 클라이언트에서 직접 매칭한다.
  // (다른 유저의 reading_results 조회이므로 이것도 서버 role 검증 라우트를 통해 가져온다)
  const loadAllResults = async () => {
    try {
      const res = await authedFetch("/api/teacher/results");
      if (!res.ok) {
        console.error("Error loading all results:", await res.text());
        return;
      }

      const { results: data } = await res.json();
      const map: Record<string, ReadingResult> = {};
      for (const r of data || []) {
        if (r.user_id && !map[r.user_id]) {
          map[r.user_id] = r as ReadingResult;
        }
      }
      setLatestByProfileId(map);
    } catch (err) {
      console.error("Error loading all results:", err);
    }
  };

  // 선택된 학생의 상세 결과 가져오기
  useEffect(() => {
    if (!selectedProfileId) {
      setCredits(null);
      return;
    }

    const loadResults = async () => {
      try {
        const res = await authedFetch(`/api/teacher/results?userId=${selectedProfileId}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        } else {
          console.error("Error loading detailed results:", await res.text());
        }
      } catch (err) {
        console.error("Error loading detailed results:", err);
      }
    };

    const loadCredits = async () => {
      try {
        const res = await authedFetch(`/api/teacher/credits?userId=${selectedProfileId}`);
        if (res.ok) {
          setCredits(await res.json());
        }
      } catch (err) {
        console.error("Error loading credit status:", err);
      }
    };

    loadResults();
    loadCredits();
  }, [selectedProfileId]);

  // 검색 필터 및 결과 없는 학생을 포함하여 정렬
  const filteredUsers = students.filter((u) =>
    (u.student_name || "").includes(keyword)
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const A = latestByProfileId[a.id];
    const B = latestByProfileId[b.id];

    const score = (x: any) => {
      if (!x) return -1; 
      let risk = 0;
      if (x.comprehension < 70) risk += 3;
      if (x.accuracy < 75) risk += 2;
      if (x.wpm < 80) risk += 1;
      return risk;
    };

    return score(B) - score(A);
  });

  const selectedStudent = students.find(
    (s) => s.id === selectedProfileId
  );

  const getStatusMeta = (x: any) => {
    if (!x)
      return {
        label: "데이터 없음",
        cls: "bg-slate-100 text-slate-500 border border-slate-200",
        Icon: CircleDashed,
      };
    if (x.comprehension < 70)
      return {
        label: "이해 부족",
        cls: "bg-red-100 text-red-700",
        Icon: CircleAlert,
      };
    if (x.accuracy < 75)
      return {
        label: "발음 불안",
        cls: "bg-amber-100 text-amber-700",
        Icon: CircleAlert,
      };
    if (x.wpm < 80)
      return {
        label: "속도 부족",
        cls: "bg-amber-100 text-amber-700",
        Icon: CircleAlert,
      };
    return {
      label: "안정",
      cls: "bg-emerald-100 text-emerald-700",
      Icon: CircleCheck,
    };
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-500 font-medium">선생님 권한 및 학생 데이터를 조회하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-600">
            <BarChart3 className="h-4 w-4" aria-hidden={true} />
            Teacher Dashboard
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            학생 리딩 현황
          </h1>
          {currentTeacher && (
            <p className="mt-1 text-sm text-slate-500">
              {currentTeacher.role === "manager" ? "매니저" : "선생님"}{" "}
              <span className="font-medium text-slate-700">
                {currentTeacher.displayName || currentTeacher.email || "이름 없음"}
              </span>
              {" "}로 로그인됨
              {currentTeacher.displayName && currentTeacher.email && (
                <span className="text-slate-400"> · {currentTeacher.email}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* 👉 좌측: 학생 목록 */}
          <aside className="w-full shrink-0 lg:w-80">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                  학생 목록
                </h3>

                <div className="relative mt-3">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden={true}
                  />
                  <input
                    placeholder="학생 이름 검색"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto">
                {sortedUsers.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">검색 결과 없음</p>
                ) : (
                  sortedUsers.map((u) => {
                    const latest = latestByProfileId[u.id];
                    const meta = getStatusMeta(latest);
                    const active = selectedProfileId === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedProfileId(u.id)}
                        className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-left transition-colors ${
                          active
                            ? "bg-indigo-50 border-r-4 border-r-indigo-500"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {u.student_name || "이름없음"}
                            {u.birth && (
                              <span className="ml-1 font-normal text-slate-400 text-xs">
                                ({u.birth})
                              </span>
                            )}
                          </div>
                          <span
                            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
                          >
                            <meta.Icon className="h-3 w-3" aria-hidden={true} />
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* 👉 우측: 학생 결과 */}
          <section className="min-w-0 flex-1">
            {!selectedProfileId ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Users className="h-6 w-6 text-slate-400" aria-hidden={true} />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">
                  학생을 선택하세요
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  좌측 목록에서 학생을 선택하면 상세 결과가 표시됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 현재 상태 요약 */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Sparkles className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                    현재 상태 요약
                  </h3>

                  {results.length > 0 ? (
                    (() => {
                      const latest = results[0];
                      const items: { label: string; cls: string }[] = [];
                      if (latest.comprehension < 70)
                        items.push({
                          label: "이해 부족",
                          cls: "bg-red-100 text-red-700",
                        });
                      if (latest.accuracy < 75)
                        items.push({
                          label: "발음 불안",
                          cls: "bg-amber-100 text-amber-700",
                        });
                      if (latest.wpm < 80)
                        items.push({
                          label: "속도 부족",
                          cls: "bg-amber-100 text-amber-700",
                        });
                      if (latest.comprehension >= 80 && latest.accuracy >= 80)
                        items.push({
                          label: "안정",
                          cls: "bg-emerald-100 text-emerald-700",
                        });

                      return (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {items.map((it, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${it.cls}`}
                            >
                              {it.label}
                            </span>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">
                      진단 테스트 내역이 존재하지 않아 요약 정보를 표시할 수 없습니다.
                    </div>
                  )}
                </div>

                {/* 결제 현황 */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Wallet className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                    결제 현황
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      리포트 결제 {results.filter((r) => r.is_unlocked).length} / {results.length}회
                    </span>
                    {credits && credits.remaining > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
                        패키지 잔여 {credits.remaining}회
                        {credits.nearestExpiry && ` · ${new Date(credits.nearestExpiry).toLocaleDateString("ko-KR")}까지`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-400">
                        보유 패키지 없음
                      </span>
                    )}
                  </div>
                </div>

                {results.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
                    아직 테스트 데이터 없음
                  </div>
                )}

                {/* 결과 리스트 */}
                {results.length > 0 &&
                  results.map((d) => {
                    if (!d.reference_text || !d.recognized_text) {
                      return null; 
                    }

                    return (
                      <div
                        key={d.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                              <FileText className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                              테스트 기록
                            </h3>
                            {d.is_unlocked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                <LockOpen className="h-3 w-3" aria-hidden={true} />
                                결제완료{d.unlock_source === "package_credit" ? " · 패키지" : ""}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                <Lock className="h-3 w-3" aria-hidden={true} />
                                미결제
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" aria-hidden={true} />
                              {new Date(d.created_at).toLocaleString("ko-KR", {
                                timeZone: "Asia/Seoul",
                              })}
                            </span>
                            <span>결과 ID: {d.id}</span>
                          </div>
                        </div>

                        <div className="px-6 py-5">
                          {/* 학생 정보 */}
                          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
                            <div>
                              <p className="flex items-center gap-1 text-xs text-slate-400">
                                <User className="h-3.5 w-3.5" aria-hidden={true} />
                                학생
                              </p>
                              <p className="mt-0.5 font-medium text-slate-900">
                                {selectedStudent?.student_name}
                              </p>
                            </div>
                            <div>
                              <p className="flex items-center gap-1 text-xs text-slate-400">
                                <Users className="h-3.5 w-3.5" aria-hidden={true} />
                                보호자
                              </p>
                              <p className="mt-0.5 font-medium text-slate-900">
                                {selectedStudent?.parent_name}
                              </p>
                            </div>
                            <div>
                              <p className="flex items-center gap-1 text-xs text-slate-400">
                                <Mail className="h-3.5 w-3.5" aria-hidden={true} />
                                이메일
                              </p>
                              <p className="mt-0.5 truncate font-medium text-slate-900">
                                {selectedStudent?.email}
                              </p>
                            </div>
                            <div>
                              <p className="flex items-center gap-1 text-xs text-slate-400">
                                <Calendar className="h-3.5 w-3.5" aria-hidden={true} />
                                생년월일
                              </p>
                              <p className="mt-0.5 font-medium text-slate-900">
                                {selectedStudent?.birth}
                              </p>
                            </div>
                          </div>

                          {/* AR + metrics */}
                          <div className="mt-4 flex items-center justify-between rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4">
                            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-300">
                              AR Level
                              {d.reading_level && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${
                                    d.reading_level === "frustration"
                                      ? "bg-rose-500/20 text-rose-300"
                                      : d.reading_level === "independent"
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : "bg-sky-500/20 text-sky-300"
                                  }`}
                                >
                                  {d.reading_level === "frustration"
                                    ? "좌절"
                                    : d.reading_level === "independent"
                                    ? "독립"
                                    : "학습"}
                                </span>
                              )}
                            </span>
                            <span className="text-2xl font-bold tabular-nums text-white">
                              {d.final_ar?.toFixed(1)}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 p-3">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Timer className="h-3.5 w-3.5" aria-hidden={true} />
                                속도
                              </div>
                              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                                {Math.round(d.wpm)}
                                <span className="ml-1 text-xs font-normal text-slate-400">
                                  WPM
                                </span>
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-3">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Target className="h-3.5 w-3.5" aria-hidden={true} />
                                정확도
                              </div>
                              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                                {Math.round(d.accuracy)}
                                <span className="ml-0.5 text-xs font-normal text-slate-400">
                                  %
                                </span>
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-3">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Brain className="h-3.5 w-3.5" aria-hidden={true} />
                                이해도
                              </div>
                              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                                {Math.round(d.comprehension)}
                                <span className="ml-0.5 text-xs font-normal text-slate-400">
                                  %
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* 진단 코멘트 */}
                          <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                            {d.reading_level === "frustration" && (
                              <p className="font-medium text-rose-600">
                                이 지문은 이 학생에게 너무 어려웠습니다 — 더 낮은 레벨로 재시험을 권장합니다
                              </p>
                            )}
                            {d.comprehension < 70 && (
                              <p>내용을 제대로 이해하지 못하고 있습니다</p>
                            )}
                            {d.accuracy < 75 && (
                              <p>발음 정확도가 낮아 소리 기반이 약합니다</p>
                            )}
                            {d.wpm < 80 && (
                              <p>읽기 속도가 느려 전체 흐름이 끊깁니다</p>
                            )}
                            {d.comprehension >= 80 && d.accuracy >= 80 && (
                              <p>전반적으로 안정적인 읽기 상태입니다</p>
                            )}
                          </div>

                          {/* 읽은 내용 / 원문 / 비교 */}
                          <div className="mt-5 space-y-5">
                            {/* 1️⃣ 아이가 읽은 내용 */}
                            <div>
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <BookOpen className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                                아이가 읽은 내용
                              </h4>
                              <div className="mt-2 rounded-xl bg-slate-50 p-4 leading-loose text-slate-700">
                                {(d.recognized_text || "")
                                  .split(". ")
                                  .map((s: string, i: number) => (
                                    <div key={i}>{s}.</div>
                                  ))}
                              </div>
                            </div>

                            {/* 2️⃣ 원문 */}
                            <div>
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <FileText className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                                원문
                              </h4>
                              <div className="mt-2 rounded-xl bg-slate-50 p-4 leading-loose text-slate-700">
                                {(d.reference_text || "")
                                  .split(". ")
                                  .map((s: string, i: number) => (
                                    <div key={i}>{s}.</div>
                                  ))}
                              </div>
                            </div>

                            {/* 3️⃣ 비교 결과 (SSR 정적 빌드 오류 원천 가드 수정) */}
                            <div>
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Target className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                                비교 결과
                              </h4>
                              <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 rounded-xl bg-slate-50 p-4 leading-loose text-slate-700 [word-break:break-word]">
                                {isMounted ? (
                                  (() => {
                                    const ref = (d.reference_text || "").split(" ");
                                    const spoken = (d.recognized_text || "").split(" ");

                                    const refClean = ref.map((w: string) => w.replace(/[^a-z]/gi, "").toLowerCase());
                                    const spokenClean = spoken.map((w: string) => w.replace(/[^a-z]/gi, "").toLowerCase());

                                    const dp = Array(ref.length + 1)
                                      .fill(0)
                                      .map(() => Array(spoken.length + 1).fill(0));

                                    for (let i = 1; i <= ref.length; i++) {
                                      for (let j = 1; j <= spoken.length; j++) {
                                        if (refClean[i - 1] === spokenClean[j - 1]) {
                                          dp[i][j] = dp[i - 1][j - 1] + 1;
                                        } else {
                                          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                                        }
                                      }
                                    }

                                    let i = ref.length;
                                    let j = spoken.length;
                                    const resultElements: any[] = [];

                                    while (i > 0 && j > 0) {
                                      if (refClean[i - 1] === spokenClean[j - 1]) {
                                        resultElements.unshift(
                                          <span key={`match-${i}-${j}`} className="text-slate-700">
                                            {ref[i - 1]}
                                          </span>
                                        );
                                        i--;
                                        j--;
                                      } else if (dp[i - 1][j] > dp[i][j - 1]) {
                                        resultElements.unshift(
                                          <span key={`miss-${i}`} className="rounded bg-blue-100 px-1 font-medium text-blue-700">
                                            {ref[i - 1]}
                                          </span>
                                        );
                                        i--;
                                      } else {
                                        resultElements.unshift(
                                          <span key={`err-${j}`} className="rounded bg-amber-100 px-1 font-medium text-amber-700">
                                            {spoken[j - 1]}
                                          </span>
                                        );
                                        j--;
                                      }
                                    }

                                    while (i > 0) {
                                      resultElements.unshift(
                                        <span key={`miss-remain-${i}`} className="rounded bg-blue-100 px-1 font-medium text-blue-700">
                                          {ref[i - 1]}
                                        </span>
                                      );
                                      i--;
                                    }

                                    while (j > 0) {
                                      resultElements.unshift(
                                        <span key={`err-remain-${j}`} className="rounded bg-amber-100 px-1 font-medium text-amber-700">
                                          {spoken[j - 1]}
                                        </span>
                                      );
                                      j--;
                                    }

                                    return resultElements;
                                  })()
                                ) : (
                                  <div className="h-6 w-32 bg-slate-100 animate-pulse rounded" />
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-3 w-3 rounded bg-blue-100" aria-hidden={true} />
                                  놓친 단어
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-3 w-3 rounded bg-amber-100" aria-hidden={true} />
                                  추가/오독
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 아이 설명 / AI 분석 */}
                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 p-4">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Brain className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                                아이 설명
                              </h4>
                              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                {d.recall_text}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-indigo-50/40 p-4">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Sparkles className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                                AI 분석
                              </h4>
                              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                {d.ai_comment}
                              </p>
                            </div>
                          </div>

                          {/* 녹음 통계 */}
                          <div className="mt-3 text-sm">
                            {d.duration_sec && d.spoken_words ? (
                              <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-slate-50 p-4 text-slate-700">
                                <p>읽기 시간: {Math.round(d.duration_sec)}초</p>
                                <p>
                                  단어: {d.spoken_words} / {d.total_words}
                                </p>
                                {d.coverage != null && (
                                  <p>커버리지: {Math.round(d.coverage * 100)}%</p>
                                )}
                              </div>
                            ) : !d.duration_sec && !d.spoken_words ? (
                              <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 font-medium text-amber-700">
                                <AlertTriangle className="h-4 w-4" aria-hidden={true} />
                                녹음 미실행
                              </p>
                            ) : (
                              <p className="flex items-center gap-2 rounded-xl bg-red-50 p-4 font-medium text-red-700">
                                <AlertTriangle className="h-4 w-4" aria-hidden={true} />
                                분석 실패 또는 녹음 오류
                              </p>
                            )}
                          </div>

                          {d.flags && d.flags.length > 0 && (
                            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
                              <AlertTriangle className="h-4 w-4" aria-hidden={true} />
                              {d.flags.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}