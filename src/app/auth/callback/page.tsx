"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        console.log("CALLBACK PAGE 진입");
        console.log("현재 URL:", window.location.href);

        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        console.log("exchange 결과:", error);

        if (error) {
          console.error("세션 생성 실패:", error);
          router.replace("/login");
          return;
        }

        const { data } = await supabase.auth.getSession();

        console.log("session:", data);

        const user = data.session?.user;

        console.log("user:", user);

        if (!user) {
          console.log("user 없음");
          router.replace("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        console.log("profile:", profile);

        if (profile) {
          console.log("reading-test 이동");
          router.replace(`/reading-test?profile_id=${profile.id}`);
        } else {
          console.log("onboarding 이동");
          router.replace("/onboarding");
        }
      } catch (err) {
        console.error("Auth callback 오류:", err);
        router.replace("/login");
      }
    };

    handleAuth();
  }, [router]);

  return <div>로그인 처리중...</div>;
}