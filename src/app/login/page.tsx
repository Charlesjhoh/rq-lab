"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");

  useEffect(() => {
    const checkSession = async () => {

      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        const userId = data.session.user.id;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();

        if (profile) {
          router.replace(`/reading-test?profile_id=${profile.id}`);
        } else {
          router.replace("/onboarding");
        }
      }
    };

    checkSession();
  }, [router]);

    const handleLogin = async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });
    if (error) {
    alert(error.message);
    return;
  }

  alert("인증번호가 이메일로 전송되었습니다.");
  setStep("otp");
};

    const handleVerifyOtp = async () => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) {
        alert("인증번호가 올바르지 않습니다.");
        return;
      }

      const { data } = await supabase.auth.getSession();

      const user = data.session?.user;

      if (!user) {
        alert("로그인 실패");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        router.replace(`/reading-test?profile_id=${profile.id}`);
      } else {
        router.replace("/onboarding");
      }
    };
  return (
    <div style={{ maxWidth: 400, margin: "100px auto" }}>
      <h2>로그인</h2>

          {step === "email" ? (
      <>
        <input
          type="email"
          placeholder="이메일 입력"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />

        <button
          onClick={handleLogin}
          style={{ width: "100%", marginTop: 20 }}
        >
          인증번호 받기
        </button>
      </>
    ) : (
      <>
        <h3>이메일로 받은 8자리 인증번호를 입력하세요</h3>

        <input
          type="text"
          maxLength={8}
          placeholder="12345678"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />

        <button
          onClick={handleVerifyOtp}
          style={{ width: "100%", marginTop: 20 }}
        >
          로그인
        </button>
      </>
    )}
    </div>
  );
}