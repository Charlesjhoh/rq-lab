"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function TeacherReportPage() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase
        .from("reading_results")
        .select("*")
        .eq("user_id", "demo_user")
        .order("created_at", { ascending: true })
        .limit(10);

      if (data) {
        const formatted = data.map((item, index) => ({
          test: index + 1,
          ar: parseFloat(item.selected_level),
          wpm: item.wpm,
          accuracy: item.scores?.accuracy ?? 0,
          comprehension: item.scores?.comprehension ?? 0,
        }));

        setData(formatted);
      }
    };

    loadData();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto" }}>
      <h2>📊 선생님용 성장 리포트</h2>

      <div style={{ width: "100%", height: 300, marginTop: 40 }}>
        <h3>AR 변화</h3>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="test" />
            <YAxis domain={[1, 6]} />
            <Tooltip />
            <Line type="monotone" dataKey="ar" stroke="#16a34a" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: "100%", height: 300, marginTop: 60 }}>
        <h3>WPM 변화</h3>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="test" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="wpm" stroke="#2563eb" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: "100%", height: 300, marginTop: 60 }}>
        <h3>정확도 변화</h3>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="test" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="accuracy" stroke="#f59e0b" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: "100%", height: 300, marginTop: 60 }}>
        <h3>이해도 변화</h3>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="test" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="comprehension" stroke="#dc2626" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}