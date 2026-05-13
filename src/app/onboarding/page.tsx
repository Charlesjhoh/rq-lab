"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function OnboardingPage() {
  const router = useRouter();

  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [birth, setBirth] = useState("");

const isFormValid =
  parentName.trim() &&
  studentName.trim() &&
  birth.trim();
  
  const handleSave = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      parent_name: parentName,
      student_name: studentName,
      role: "student",
      birth,
      email: user?.email,
    });

    if (error) {
      console.error(error);
      alert("정보 저장 중 오류가 발생했습니다.");
      return;
    }

    router.push(`/reading-test?profile_id=${data.id}`);
  };

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