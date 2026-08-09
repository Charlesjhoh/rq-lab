"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase-client";

export default function JoinClassForm({ alreadyJoined }: { alreadyJoined: boolean }) {
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (alreadyJoined) return null;

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage("로그인이 필요합니다.");
        return;
      }

      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ ${data.error || "참여에 실패했습니다."}`);
        return;
      }

      setMessage(`✅ "${data.className}" 클래스에 참여했습니다.`);
    } catch (err) {
      console.error(err);
      setMessage("❌ 참여 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white shadow-md rounded-xl p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-3">선생님 참여코드</h2>
      <p className="text-xs text-gray-500 mb-3">
        다니는 학원/선생님이 있다면 선생님께 참여코드를 요청해서 입력하세요.
      </p>
      <div className="flex gap-2">
        <input
          placeholder="참여코드 입력"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJoin();
          }}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={handleJoin}
          disabled={busy || !joinCode.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "참여 중..." : "참여하기"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
    </section>
  );
}
