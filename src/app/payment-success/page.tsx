"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";

// 🔥 Next.js 빌드 시 정적 사전 렌더링 에러를 방지하기 위해 dynamic 옵션 추가
export const dynamic = "force-dynamic";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const paymentIntent = searchParams.get("payment_intent");
  const resultId = searchParams.get("result_id");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-10 w-10" />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-slate-900 sm:text-3xl">
        결제가 완료되었습니다!
      </h1>
      
      <p className="mt-2 text-sm text-slate-600 sm:text-base">
        프리미엄 리포트를 확인할 준비가 완료되었습니다.
      </p>

      {paymentIntent && (
        <div className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-xs font-mono text-slate-500">
          주문 번호: {paymentIntent}
        </div>
      )}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={() => {
            if (resultId) {
              router.push(`/premium-report?result_id=${resultId}`);
            } else {
              router.push("/");
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          프리미엄 리포트 보러가기
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center text-slate-500">
          결제 결과를 확인하는 중...
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}