"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Sparkles, Gauge, Target, BookOpen, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  // 상태 관리
  const [showForm, setShowForm] = useState(false);
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [birth, setBirth] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Supabase 클라이언트 설정
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // 기존 프로필 정보 로드
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);

          const { data: profile, error } = await supabase
            .from("profiles")
            .select("parent_name, student_name, birth")
            .eq("id", user.id)
            .single();

          if (profile && !error) {
            if (profile.parent_name) setParentName(profile.parent_name);
            if (profile.student_name) setStudentName(profile.student_name);
            if (profile.birth) setBirth(profile.birth);
            
            setShowForm(true);
          }
        }
      } catch (err) {
        console.error("프로필 정보 로딩 오류:", err);
      }
    };
    loadUserProfile();
  }, []);

  // ✅ [보안 강화] role 권한을 절대로 건드리지 않고 학생 정보만 업데이트/저장하는 핸들러
  const handleContinue = async () => {
    if (!parentName.trim() || !studentName.trim() || !birth.trim()) {
      alert("모든 정보를 입력해 주세요.");
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || userId;

      if (currentUserId) {
        // 1. 현재 DB에 설정되어 있는 유저의 기존 profile (특히 role)을 먼저 안전하게 조회
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUserId)
          .maybeSingle();

        // 2. 저장할 데이터 생성 (기존 role이 있다면 그대로 유지, 없으면 생략)
        // NOTE: profiles 테이블에는 updated_at 컬럼이 없다. 넣으면 PGRST204로 저장 자체가
        // 실패한다(온보딩 화면의 upsert도 이 컬럼을 쓰지 않음).
        const updateData: Record<string, any> = {
          id: currentUserId,
          parent_name: parentName.trim(),
          student_name: studentName.trim(),
          birth: birth.trim(),
        };

        // 기존에 role 권한이 존재하는 경우 role 컬럼 값을 보존
        if (existingProfile?.role) {
          updateData.role = existingProfile.role;
        }

        // 3. upsert 실행 (role 권한 유실 완벽 차단)
        const { error } = await supabase
          .from("profiles")
          .upsert(updateData, { onConflict: "id" });

        if (error) {
          console.error("DB 저장 중 오류 발생:", error);
        }

        // 4. 저장 후 reading-test 페이지로 이동
        router.push(`/reading-test?profile_id=${currentUserId}`);
      } else {
        router.push("/reading-test");
      }
    } catch (err) {
      console.error("저장 및 이동 처리 실패:", err);
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-white via-slate-50 to-indigo-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl mx-auto flex flex-col items-center">

        {/* 1부: 서비스 소개 및 안내 카드 */}
        <div className="w-full bg-white/70 backdrop-blur-md rounded-3xl p-8 border border-white/50 shadow-xl text-center">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Free Beta v2.4</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
            AI Reading Assessment
          </h1>
          <p className="text-base text-slate-500 max-w-md mx-auto mb-8">
            AI가 아이의 영어 읽기를 3분 안에 정밀 분석합니다. 잠재력을 발견해 보세요.
          </p>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600"><Gauge className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Reading Speed</p>
                <p className="text-sm font-semibold text-slate-700">WPM 측정</p>
              </div>
            </div>
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600"><Target className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Accuracy</p>
                <p className="text-sm font-semibold text-slate-700">발음 정확도</p>
              </div>
            </div>
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600"><BookOpen className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Estimated AR</p>
                <p className="text-sm font-semibold text-slate-700">리딩 레벨 산정</p>
              </div>
            </div>
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600"><Sparkles className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Comprehension</p>
                <p className="text-sm font-semibold text-slate-700">이해도 진단</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full border-t-2 border-dashed border-slate-200/60 my-8" />

        {/* 2부: 정보 입력 카드 */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full h-[72px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xl rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
          >
            <span>무료 테스트 시작하기</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        ) : (
          <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/60 shadow-xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Student Information</h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-2 py-1">
              <label className="text-sm font-semibold text-slate-500 sm:w-28 sm:text-right">Parent Name</label>
              <input
                type="text"
                placeholder="학부모 성함을 입력하세요"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-center sm:text-left"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-2 py-1">
              <label className="text-sm font-semibold text-slate-500 sm:w-28 sm:text-right">Student Name</label>
              <input
                type="text"
                placeholder="학생 이름을 입력하세요"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-center sm:text-left"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-2 py-1">
              <label className="text-sm font-semibold text-slate-500 sm:w-28 sm:text-right">Birth Date</label>
              <input
                type="date"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-center"
              />
            </div>
          </div>
        )}

        {/* 3부: 제출 버튼 */}
        {showForm && (
          <>
            <div className="w-full border-t-2 border-dashed border-slate-200/60 my-8" />
            <button
              onClick={handleContinue}
              disabled={saving}
              className="w-full h-[72px] bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </>
        )}

        <div className="mt-8 flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Your information is securely stored and protected.</span>
        </div>

      </div>
    </div>
  );
}