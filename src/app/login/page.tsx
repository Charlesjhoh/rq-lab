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

      if (data.session) {
        router.replace("/reading-test");
      }
    };
    checkUser();
  }, [router]);

      useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "SIGNED_IN" && session?.user) {
              router.push("/reading-test");
            }
          }
        );

        return () => {
          listener.subscription.unsubscribe();
        };
      }, []);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://rq-lab.vercel.app/login",
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
    </div>
  );
}