"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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

      <h3>
        이메일을 확인해주세요. 로그인 링크를 클릭하면 자동으로 이동됩니다.
      </h3>
    </div>
  );
}