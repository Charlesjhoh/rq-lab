"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { BookOpen, Mail, KeyRound, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        // 이미 로그인 상태면 정보를 확인/입력할 수 있는 폼 페이지로 이동
        router.replace("/onboarding"); // (프로젝트 구조에 따라 "/" 또는 "/onboarding")
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
      console.log(error);
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

    // 로그인 완료 후 폼 화면으로 이동
    router.replace("/onboarding");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 p-10 text-white md:flex">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl"
            aria-hidden={true}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl"
            aria-hidden={true}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" aria-hidden={true} />
              AI Reading Lab
            </span>
            <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-900/40">
              <BookOpen className="h-7 w-7 text-white" aria-hidden={true} />
            </div>
            <h1 className="mt-6 text-balance text-3xl font-bold leading-tight tracking-tight">
              아이의 읽기 성장을 한눈에
            </h1>
            <p className="mt-3 max-w-xs text-pretty text-sm leading-relaxed text-slate-300">
              AI가 분석한 맞춤 리딩 리포트와 성장 로드맵을 지금 확인하세요.
            </p>
          </div>
          <p className="relative text-xs text-slate-400">
            안전한 이메일 인증으로 로그인합니다.
          </p>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center p-8 md:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {step === "email" ? "로그인" : "인증번호 입력"}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              {step === "email"
                ? "이메일로 인증번호를 보내드립니다."
                : `${email} 로 전송된 8자리 번호를 입력하세요.`}
            </p>
          </div>

          {step === "email" ? (
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  이메일
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) handleLogin();
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <button
                onClick={handleLogin}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                인증번호 받기
                <ArrowRight className="h-4 w-4" aria-hidden={true} />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label htmlFor="otp" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  인증번호
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="12345678"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) handleVerifyOtp();
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm tracking-[0.3em] text-slate-900 outline-none transition-colors placeholder:tracking-[0.3em] placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <button
                onClick={handleVerifyOtp}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                로그인
                <ArrowRight className="h-4 w-4" aria-hidden={true} />
              </button>

              <button
                onClick={() => setStep("email")}
                className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden={true} />
                이메일 다시 입력
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}