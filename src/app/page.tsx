"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";


export default function HomePage() {
    const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [birth, setBirth] = useState("");


  useEffect(() => {
  const loadUserProfile = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) return;

    // 👉 profiles 테이블에서 정보 가져오기
    const { data: profile } = await supabase
      .from("profiles")
      .select("parent_name, student_name, birth")
      .eq("id", user.id)
      .maybeSingle()

    if (profile) {
      setParentName(profile.parent_name || "");
      setStudentName(profile.student_name || "");
      setBirth(profile.birth || "");
    }
  };

  loadUserProfile();
}, []);

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: "0 auto" }}>
      <h1>📘 Reading App</h1>

      <h2 style={{ marginTop: 20 }}>
        AI가 아이의 영어 원서 읽기 수준을 분석해드립니다
      </h2>

      <div style={{ marginTop: 20, background: "#f5f5f5", padding: 16 }}>
        <b>📢 베타 테스트 안내</b>
        <p>현재 무료로 리딩 진단 테스트를 제공하고 있습니다.</p>
        <p>테스트 결과를 기반으로 맞춤 도서와 학습 방향을 제안합니다.</p>
        <p style={{ fontSize: 12, color: "#888" }}>
          ※ 일부 기능은 테스트 단계로 제한될 수 있습니다
        </p>
      </div>

      <div style={{ marginTop: 30 }}>
        <button
            onClick={async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              if (!user) {
                router.push("/login");
                return;
              }

              setShowForm(true); // 🔥 여기 핵심
            }}
          style={{
            padding: "12px 20px",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          👉 무료 테스트 시작하기
        </button>
      </div>
        {showForm && (
          <div style={{ marginTop: 20 }}>
            <input
              placeholder="학부모 이름"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              style={{ display: "block", marginBottom: 10, width: "100%" }}
            />

            <input
              placeholder="학생 이름"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              style={{ display: "block", marginBottom: 10, width: "100%" }}
            />

            <input
              placeholder="생년월일 (예: 2015-03-21)"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              style={{ display: "block", marginBottom: 10, width: "100%" }}
            />

            <button
            onClick={async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              // 🔥 여기서 바로 차단
              if (!user) {
                alert("로그인 후 이용해주세요");
                router.push("/login");
                return;
              }

              // 그 다음에 입력값 체크
              if (!parentName || !studentName || !birth) {
                alert("모든 정보를 입력해주세요");
                return;
              }

  // 그 다음 DB

              // 3️⃣ DB 저장
              const { data, error } = await supabase
                .from("profiles")
                .upsert(
                  {
                    id: user.id,
                    student_name: studentName,
                    parent_name: parentName,
                    birth: birth,
                  },
                  {
                    onConflict: "id",
                  }
                )
                .select()
                .single();


              // 🔥 여기서 바로 체크
              if (error) {
                console.error("❌ DB 에러:", error);
                alert("저장 실패");
                return;
              }
console.log("error:", error);
              if (!data) {
                console.error("❌ data 없음");
                alert("데이터 없음");
                return;
              }
if (!data) {
  alert("데이터 없음");
  return;
}

//const profile = data[0];

              // 🔥 여기서만 사용
              router.push(`/reading-test?profile_id=${data.id}`);
            }}
            >
              시작하기
            </button>
          </div>
        )}
      <p style={{ marginTop: 20, fontSize: 13, color: "#666" }}>
        ※ 결과 저장 및 리포트 확인을 위해 로그인이 필요합니다
      </p>
    </div>
  );
}