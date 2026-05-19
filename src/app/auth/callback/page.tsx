"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {

      const { data } = await supabase.auth.getSession();

      const user = data.session?.user;

      if (!user) {
        router.replace("/login");
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

    handleAuth();
  }, [router]);

  return <div>로그인 처리중...</div>;
}