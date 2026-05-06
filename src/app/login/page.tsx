"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  // ✅ 로그인 상태면 자동 이동 (수정된 부분)
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();

       if (data.session?.user) {
      const userId = data.session.user.id;
      router.replace("/"); // 🔥 여기 핵심
      // ✅ 프로필 존재 여부 확인
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profile) {
        router.replace("/reading-test"); // 기존 유저
      } else {
        router.replace("/onboarding"); // 신규 유저 (정보 입력 페이지)
      }
    }
  };

  checkUser();
}, [router]);

      useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === "SIGNED_IN" && session?.user) {
              const userId = session.user.id;

              const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

              if (profile) {
                router.push("/reading-test");
              } else {
                router.push("/onboarding");
              }
            }
          }
        );

        return () => {
          listener.subscription.unsubscribe();
        };
      }, [router]);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });

    if (!error) {
      alert("이메일로 로그인 링크가 전송되었습니다.");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto" }}>
      <h2>로그인</h2>
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
        로그인 링크 받기
      </button>
      <h3> 이메일을 확인해주세요. 로그인 링크를 클릭하면 자동으로 이동됩니다. </h3>
    </div>
  );
}