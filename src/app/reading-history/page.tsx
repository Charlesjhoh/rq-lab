"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

export default function ReadingHistoryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const userId = localStorage.getItem("reading_user_id");
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("reading_results")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
      } else {
        setRecords(data || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <p>불러오는 중...</p>;

  return (
    <main style={{ padding: 40 }}>
      <h1>📊 나의 리딩 진단 기록</h1>

      {records.length === 0 ? (
        <p style={{ marginTop: 20 }}>아직 기록이 없습니다.</p>
      ) : (
        <table
          style={{
            marginTop: 20,
            borderCollapse: "collapse",
            width: "100%",
          }}
        >
          <thead>
            <tr>
              <th style={th}>날짜</th>
              <th style={th}>선택 레벨</th>
              <th style={th}>평균 점수</th>
              <th style={th}>안정성</th>
              <th style={th}>판정</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td style={td}>{r.selected_level}</td>
                <td style={td}>{r.average_score.toFixed(1)}</td>
                <td style={td}>{r.stability.toFixed(1)}</td>
                <td style={td}>{r.result_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  borderBottom: "1px solid #ccc",
  padding: 10,
  textAlign: "left",
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #eee",
};
