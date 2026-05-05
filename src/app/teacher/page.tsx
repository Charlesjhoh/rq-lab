"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function TeacherPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);



  const [search, setSearch] = useState("");
  const router = useRouter();

  // ✅ 1. 전체 학생 목록 (profiles 기준)
type Student = {
  id: string;
  student_name: string;
  parent_name: string;
  birth: string;
};

const [students, setStudents] = useState<Student[]>([]);

const [keyword, setKeyword] = useState("");
const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

const [allResults, setAllResults] = useState([]);
useEffect(() => {
  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, student_name, parent_name, birth")
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
    .order("created_at", { foreignTable: "reading_results", ascending: false });
    if (data) setAllResults(data);
  };

  loadAll();
}, []);


useEffect(() => {
  console.log("현재 선택된 user:", selectedUserId);
}, [selectedUserId]);
  // ✅ 2. 선택된 학생의 결과만 가져오기
      useEffect(() => {
        if (!selectedUserId) return;

        const loadResults = async () => {
          const { data, error } = await supabase
            .from("reading_results")
            .select(`
              *,
              profiles (
                student_name,
                parent_name
              )
            `)
            .eq("user_id", selectedUserId)
            .order("created_at", { ascending: false });

          if (!error) {
            setResults(data);
          }
        };

        loadResults();
      }, [selectedUserId]); // 🔥 이거 반드시 있어야 함

  // ✅ 3. 검색 필터
    const filteredUsers = students.filter((u) =>
      (u.student_name || "").includes(keyword)
    );
      // 🔥 여기다 넣는거다 (이 줄 바로 아래)

      const latestMap = Object.fromEntries(
        allResults.map((u: any) => {
          const latest = u.reading_results?.[0];
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

  return (
    <div style={{ padding: 20, display: "flex", gap: 20 }}>
      
      {/* 👉 좌측: 학생 목록 */}
      <div style={{ width: 250 }}>
        <h3>👤 학생 목록</h3>

        {/* 🔍 검색 */}
        <input
          placeholder="학생 이름 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        {/* 학생 리스트 */}

        {filteredUsers.length === 0 ? (
          <p>검색 결과 없음</p>
        ) : (
          sortedUsers.map((u) => {
            const latest = latestMap[u.id];
            const getStatus = (x: any) => {
              if (!x) return "⚪ 데이터 없음";

              if (x.comprehension < 70) return "🔴 이해 부족";
              if (x.accuracy < 75) return "🟡 발음 불안";
              if (x.wpm < 80) return "🟡 속도 부족";

              return "🟢 안정";
            };
            return (
              <div
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                style={{
                  cursor: "pointer",
                  padding: "8px",
                  borderBottom: "1px solid #ddd",
                  background:
                    latest && latest.comprehension < 70
                      ? "#ffe5e5"
                      : "white",
                }}
              >
                <div>
                  <b>{u.student_name || "이름없음"}</b>
                  {u.birth && ` (${u.birth})`}
                </div>

                <div style={{ fontSize: 12, color: "#666" }}>
                  {getStatus(latest)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 👉 우측: 학생 결과 */}
      <div style={{ flex: 1 }}>
        <h3>📊 학생 결과</h3>
        <p>선택된 ID: {selectedUserId}</p>
          <p><b>현재 상태 요약</b></p>

          {results.length > 0 && (
            (() => {
              const latest = results[0];

              return (
                <div style={{ marginTop: 10 }}>
                  {latest.comprehension < 70 && <p>🔴 이해 부족</p>}
                  {latest.accuracy < 75 && <p>🟡 발음 불안</p>}
                  {latest.wpm < 80 && <p>🟡 속도 부족</p>}
                  {latest.comprehension >= 80 && latest.accuracy >= 80 && (
                    <p>🟢 안정</p>
                  )}
                </div>
              );
            })()
          )}

        {!selectedUserId && <p>학생을 선택하세요</p>}

        {selectedUserId && (
          <> 


           {/* 🔥 여기 추가 */}
            {results.length === 0 ? (
              <p style={{ color: "#888" }}>아직 테스트 데이터 없음</p>
            ) : (
              <>
                    </>
             )}

            {/* 결과 리스트 */}
            {results.length === 0 && (
              <p style={{ color: "#888" }}>
                아직 기록이 없습니다
              </p>
            )}
                  {results.length > 0 &&
                    results.map((d) => {
                      if (!d.reference_text || !d.recognized_text) {
                        return null; // 🔥 핵심 방어
                      }
const student = d.profiles;
                      return (
                        <div key={d.id}>

                  <p>
                    학생: {student?.student_name} / 보호자: {student?.parent_name}
                  </p>

                  <p>AR: {d.final_ar?.toFixed(1)}</p>
                  <div style={{ marginTop: 10, padding: 10, background: "#f5f5f5" }}>
                    {d.comprehension < 70 && (
                      <p>👉 내용을 제대로 이해하지 못하고 있습니다</p>
                    )}
                    {d.accuracy < 75 && (
                      <p>👉 발음 정확도가 낮아 소리 기반이 약합니다</p>
                    )}
                    {d.wpm < 80 && (
                      <p>👉 읽기 속도가 느려 전체 흐름이 끊깁니다</p>
                    )}
                    {d.comprehension >= 80 && d.accuracy >= 80 && (
                      <p>👉 전반적으로 안정적인 읽기 상태입니다</p>
                    )}
                  </div>
                  <p>속도: {Math.round(d.wpm)} WPM</p>
                  <p>정확도: {Math.round(d.accuracy)}%</p>
                  <p>이해도: {Math.round(d.comprehension)}%</p>

                  <hr />

                  <div style={{ marginTop: 20 }}>

                    {/* 1️⃣ 아이가 읽은 내용 */}
                    <h4>📖 아이가 읽은 내용</h4>
                    <div style={{ lineHeight: "2" }}>
                      {(d.recognized_text || "")
                        .split(". ")
                        .map((s: string, i: number) => (
                          <div key={i}>{s}.</div>
                        ))}
                    </div>

                    {/* 2️⃣ 원문 */}
                    <h4 style={{ marginTop: 20 }}>📘 원문</h4>
                    <div style={{ lineHeight: "2" }}>
                      {(d.reference_text || "")
                        .split(". ")
                        .map((s: string, i: number) => (
                          <div key={i}>{s}.</div>
                        ))}
                    </div>

                    {/* 3️⃣ 🔥 비교 결과 (핵심) */}
                    <h4 style={{ marginTop: 20 }}>🎯 비교 결과</h4>

                    <div style={{ lineHeight: "2", wordBreak: "break-word" }}>
                      {(() => {
                        const ref = (d.reference_text || "").split(" ");
                        const spoken = (d.recognized_text || "").split(" ");

                        const refClean = ref.map(w => w.replace(/[^a-z]/gi, "").toLowerCase());
                        const spokenClean = spoken.map(w => w.replace(/[^a-z]/gi, "").toLowerCase());

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
                              <span key={`${i}-${j}`} style={{ marginRight: 6 }}>
                                {ref[i - 1]}
                              </span>
                            );
                            i--;
                            j--;
                          } else if (dp[i - 1][j] > dp[i][j - 1]) {
                            result.unshift(
                              <span key={`m-${i}`} style={{ color: "blue", marginRight: 6 }}>
                                {ref[i - 1]}
                              </span>
                            );
                            i--;
                          } else {
                            result.unshift(
                              <span key={`e-${j}`} style={{ color: "orange", marginRight: 6 }}>
                                {spoken[j - 1]}
                              </span>
                            );
                            j--;
                          }
                        }

                        while (i > 0) {
                          result.unshift(
                            <span key={`m-${i}`} style={{ color: "blue", marginRight: 6 }}>
                              {ref[i - 1]}
                            </span>
                          );
                          i--;
                        }

                        while (j > 0) {
                          result.unshift(
                            <span key={`e-${j}`} style={{ color: "orange", marginRight: 6 }}>
                              {spoken[j - 1]}
                            </span>
                          );
                          j--;
                        }

                        return result;
                      })()}
                    </div>

                  </div>
                  <h4>🧠 아이 설명</h4>
                  <p>{d.recall_text}</p>

                  <h4>🤖 AI 분석</h4>
                  <p>{d.ai_comment}</p>
                  {d.duration_sec && d.spoken_words ? (
                    <>
                      <p>읽기 시간: {Math.round(d.duration_sec)}초</p>
                      <p>
                        단어: {d.spoken_words} / {d.total_words}
                      </p>
                      <p>
                        커버리지: {Math.round(d.coverage * 100)}%
                      </p>
                    </>
                  ) : !d.duration_sec && !d.spoken_words ? (
                    <p style={{ color: "orange" }}>
                      ⚠️ 녹음 미실행
                    </p>
                  ) : (
                    <p style={{ color: "red" }}>
                      ⚠️ 분석 실패 또는 녹음 오류
                    </p>
                  )}

                  {d.flags?.length > 0 && (
                    <div style={{ color: "red" }}>
                      ⚠️ {d.flags.join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
