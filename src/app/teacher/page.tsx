"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

export default function TeacherPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);



  const [search, setSearch] = useState("");
  const router = useRouter();

  // ✅ 1. 전체 학생 목록 (profiles 기준)
type Student = {
  id: string;
  student_id: string;
  student_name: string;
  parent_name: string;
  birth: string;
  email: string;
};

const [students, setStudents] = useState<Student[]>([]);

const [keyword, setKeyword] = useState("");
const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

type ReadingResult = {
  id: string;
  wpm: number;
  accuracy: number;
  comprehension: number;
};

type StudentWithResults = {
  id: string;
  student_name: string;
  reading_results: ReadingResult[];
};

const [allResults, setAllResults] = useState<StudentWithResults[]>([]);
useEffect(() => {
  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, student_id, student_name, parent_name, birth, email")
    console.log("🔥 profiles data:", data); // 👈 여기
    if (data) setStudents(data);
  };

  load();
}, []);

useEffect(() => {
  const loadAll = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        student_id,
        student_name,
        reading_results (
          id,
          wpm,
          accuracy,
          comprehension,
          final_ar,
          created_at
        )
      `)
      .order("created_at", {
        foreignTable: "reading_results",
        ascending: false,
      });

    console.log(data);
    console.log(error);

    if (data) setAllResults(data);
  };

  loadAll();
}, []);


useEffect(() => {
  console.log("현재 선택된 user:", selectedStudentId);
}, [selectedStudentId]);
  // ✅ 2. 선택된 학생의 결과만 가져오기
      useEffect(() => {
        if (!selectedStudentId) return;

        const loadResults = async () => {
          const { data, error } = await supabase
            .from("reading_results")
            .select("*")
            .eq("student_id", selectedStudentId)
            .order("created_at", { ascending: false });

          if (!error) {
            setResults(data);
          }
        };

        loadResults();
      }, [selectedStudentId]); // 🔥 이거 반드시 있어야 함

  // ✅ 3. 검색 필터
    const filteredUsers = students.filter((u) =>
      (u.student_name || "").includes(keyword)
    );
      // 🔥 여기다 넣는거다 (이 줄 바로 아래)

      const latestMap = Object.fromEntries(
        allResults.map((u: any) => {
          const latest = u.reading_results?.[0] ?? null;
          return [u.id, latest];
        })
      );
      const sortedUsers = [...filteredUsers].sort((a, b) => {
        const A = latestMap[a.id];
        const B = latestMap[b.id];

        const score = (x: any) => {
          if (!x) return 0;
          let risk = 0;
          if (x.comprehension < 70) risk += 3;
          if (x.accuracy < 75) risk += 2;
          if (x.wpm < 80) risk += 1;
          return risk;
        };

        return score(B) - score(A);
      });
      const selectedStudent = students.find(
        (s) => s.student_id === selectedStudentId
      );

  // status helpers (presentation only)
  const getStatusMeta = (x: any) => {
    if (!x)
      return {
        label: "데이터 없음",
        cls: "bg-slate-100 text-slate-500",
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

                {/* 🔍 검색 */}
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

              {/* 학생 리스트 */}
              <div className="max-h-[70vh] overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">검색 결과 없음</p>
                ) : (
                  sortedUsers.map((u) => {
                    const latest = latestMap[u.id];
                    const meta = getStatusMeta(latest);
                    const active = selectedStudentId === u.student_id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedStudentId(u.student_id)}
                        className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-left transition-colors ${
                          active
                            ? "bg-indigo-50"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {u.student_name || "이름없음"}
                            {u.birth && (
                              <span className="ml-1 font-normal text-slate-400">
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
            {!selectedStudentId ? (
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

                  {results.length > 0 &&
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
                    })()}
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
                      return null; // 🔥 핵심 방어
                    }

                    return (
                      <div
                        key={d.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        {/* header */}
                        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <FileText className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                            테스트 기록
                          </h3>
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
                            <span className="text-xs font-medium uppercase tracking-widest text-indigo-300">
                              AR Level
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

                            {/* 3️⃣ 🔥 비교 결과 (핵심) */}
                            <div>
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Target className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                                비교 결과
                              </h4>
                              <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 rounded-xl bg-slate-50 p-4 leading-loose text-slate-700 [word-break:break-word]">
                                {(() => {
                                  const ref = (d.reference_text || "").split(" ");
                                  const spoken = (d.recognized_text || "").split(" ");

                                  const refClean = ref.map((w: string) => w.replace(/[^a-z]/gi, "").toLowerCase());
                                  const spokenClean = spoken.map((w: string) => w.replace(/[^a-z]/gi, "").toLowerCase());

                                  // 🔥 LCS DP
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

                                  // 🔥 backtrack
                                  let i = ref.length;
                                  let j = spoken.length;
                                  const result: any[] = [];

                                  while (i > 0 && j > 0) {
                                    if (refClean[i - 1] === spokenClean[j - 1]) {
                                      result.unshift(
                                        <span key={`${i}-${j}`} className="text-slate-700">
                                          {ref[i - 1]}
                                        </span>
                                      );
                                      i--;
                                      j--;
                                    } else if (dp[i - 1][j] > dp[i][j - 1]) {
                                      result.unshift(
                                        <span key={`m-${i}`} className="rounded bg-blue-100 px-1 font-medium text-blue-700">
                                          {ref[i - 1]}
                                        </span>
                                      );
                                      i--;
                                    } else {
                                      result.unshift(
                                        <span key={`e-${j}`} className="rounded bg-amber-100 px-1 font-medium text-amber-700">
                                          {spoken[j - 1]}
                                        </span>
                                      );
                                      j--;
                                    }
                                  }

                                  while (i > 0) {
                                    result.unshift(
                                      <span key={`m-${i}`} className="rounded bg-blue-100 px-1 font-medium text-blue-700">
                                        {ref[i - 1]}
                                      </span>
                                    );
                                    i--;
                                  }

                                  while (j > 0) {
                                    result.unshift(
                                      <span key={`e-${j}`} className="rounded bg-amber-100 px-1 font-medium text-amber-700">
                                        {spoken[j - 1]}
                                      </span>
                                    );
                                    j--;
                                  }

                                  return result;
                                })()}
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
                                <p>커버리지: {Math.round(d.coverage * 100)}%</p>
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

                          {d.flags?.length > 0 && (
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
