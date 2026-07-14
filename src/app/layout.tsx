"use client";

import "./globals.css";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useEffect, useState } from "react";
import { BookOpen, FileText, LogOut, LogIn } from "lucide-react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    router.replace("/login");
  };

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
    <html lang="en" className="bg-slate-50">
      <body className="bg-slate-50">
        {/* 상단 바 */}
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                <BookOpen className="h-5 w-5" aria-hidden={true} />
              </span>
              <span className="text-base font-semibold tracking-tight text-slate-900">
                Reading App
              </span>
            </button>

            <nav className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!userId) {
                    router.push("/login");
                    return;
                  }
                  router.push(`/report?user_id=${userId}`);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <FileText className="h-4 w-4" aria-hidden={true} />
                리포트
              </button>

              {userId ? (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <LogOut className="h-4 w-4" aria-hidden={true} />
                  로그아웃
                </button>
              ) : (
                <button
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <LogIn className="h-4 w-4" aria-hidden={true} />
                  로그인
                </button>
              )}
            </nav>
          </div>
        </header>

        {/* 기존 페이지 */}
        {children}
      </body>
    </html>
  );
}
