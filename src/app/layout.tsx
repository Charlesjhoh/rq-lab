"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

    const handleLogout = async () => {
      await supabase.auth.signOut();

      setUserId(null);
const result = await supabase.auth.getSession()
console.log(result.data.session)
      router.replace("/login");
    };
  
const [userId, setUserId] = useState<string | null>(null);

useEffect(() => {
  const getSession = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (session?.user) {
      setUserId(session.user.id);
    }
  };

  getSession();

  // 🔥 로그인 상태 변화 감지 (이거 중요)
  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    }
  );

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);
  return (
    <html lang="en">
      <body>
        {/* 🔥 상단 바 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 20px",
            borderBottom: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: "bold" }}>📘 Reading App</div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => {
                if (!userId) {
                  router.push("/login");
                  return;
                }
                router.push(`/report?user_id=${userId}`);
              }}
            >
              리포트
            </button>

            {userId ? (
              <button
                onClick={handleLogout}
                style={{ padding: "6px 12px" }}
              >
                로그아웃
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                style={{ padding: "6px 12px" }}
              >
                로그인
              </button>
            )}
          </div>
        </div>

        {/* 기존 페이지 */}
        <div style={{ padding: 20 }}>
          {children}
        </div>
      </body>
    </html>
  );
}