"use client";

import Link from "next/link";
import { useRef } from "react";

export default function Footer() {
  const kbFormRef = useRef<HTMLFormElement>(null);

  const openKbAuthMark = () => {
    window.open(
      "",
      "KB_AUTHMARK",
      "height=604, width=648, status=yes, toolbar=no, menubar=no, location=no"
    );
    const form = kbFormRef.current;
    if (form) {
      form.target = "KB_AUTHMARK";
      form.submit();
    }
  };

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-600">
          <Link href="/terms" className="hover:text-slate-900 hover:underline">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-slate-900 hover:underline">
            개인정보처리방침
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-0.5 text-xs leading-relaxed text-slate-400">
            <p>상호: (주)베이컨랩스 · 대표: 오정현</p>
            <p>사업자등록번호: 715-88-03752 · 통신판매업신고번호: 제2026-경기파주-3431호</p>
            <p>주소: 파주시 경의로 1068 6층 603-31호</p>
            <p>고객센터: charles.j.h.oh@gmail.com</p>
            <p className="pt-1">© {new Date().getFullYear()} (주)베이컨랩스. All rights reserved.</p>
          </div>

          {/* KB에스크로 이체 인증마크 */}
          <div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                openKbAuthMark();
              }}
            >
              <img
                src="https://img1.kbstar.com/img/escrow/escrowcmark.gif"
                alt="KB에스크로 이체 인증마크"
                width={72}
                height={72}
              />
            </a>
            <form ref={kbFormRef} name="KB_AUTHMARK_FORM" method="get" action="https://okbfex.kbstar.com/quics" className="hidden">
              <input type="hidden" name="page" value="C021590" />
              <input type="hidden" name="cc" value="b034066:b035526" />
              <input type="hidden" name="mHValue" value="5bfd61732a3eaf3dd62ca90d7e2b6d6c" />
            </form>
          </div>
        </div>
      </div>
    </footer>
  );
}
