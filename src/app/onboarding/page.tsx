"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function OnboardingPage() {
  const router = useRouter();

  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [birth, setBirth] = useState("");
  const [loading, setLoading] = useState(true);
  const [existingRole, setExistingRole] = useState<string | null>(null);

  // 1. 기존 데이터 불러오기 로직 추가
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        alert("로그인이 필요합니다.");
        router.push("/login");
        return;
      }

      // 기존 profiles 데이터 조회
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("parent_name, student_name, birth, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("프로필 불러오기 실패:", error);
      } else if (profile) {
        // 기존 정보가 있다면 input 상태에 바인딩
        if (profile.parent_name) setParentName(profile.parent_name);
        if (profile.student_name) setStudentName(profile.student_name);
        if (profile.birth) setBirth(profile.birth);
        if (profile.role) setExistingRole(profile.role);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const isFormValid =
    parentName.trim() !== "" &&
    studentName.trim() !== "" &&
    birth.trim() !== "";

  const handleSave = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        parent_name: parentName,
        student_name: studentName,
        role: existingRole || "student",
        birth,
        email: user.email,
      },
      {
        onConflict: "id",
      }
    );

    if (error) {
      console.error(error);
      alert("정보 저장 중 오류가 발생했습니다.");
      return;
    }

    // 테스트 페이지로 이동
    router.push(`/reading-test?profile_id=${user.id}`);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
        <p>정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 20 }}>
      <h2>학생 정보 입력</h2>

      <input
        placeholder="학부모 이름"
        value={parentName}
        onChange={(e) => setParentName(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 16 }}
      />

      <input
        placeholder="학생 이름"
        value={studentName}
        onChange={(e) => setStudentName(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 12 }}
      />

      <input
        type="date"
        value={birth}
        onChange={(e) => setBirth(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 12 }}
      />

      {!isFormValid && (
        <p style={{ color: "red", marginTop: 8 }}>
          모든 정보를 입력해야 테스트를 진행할 수 있습니다.
        </p>
      )}

      <button
        disabled={!isFormValid}
        style={{
          width: "100%",
          padding: 12,
          marginTop: 16,
          opacity: isFormValid ? 1 : 0.5,
          cursor: isFormValid ? "pointer" : "not-allowed",
        }}
        onClick={handleSave}
      >
        저장하고 테스트 시작
      </button>
    </div>
  );
}