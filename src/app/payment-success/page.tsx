'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const paymentIntent = searchParams.get('payment_intent');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-gray-800">결제가 완료되었습니다!</h1>
        <p className="text-gray-600 text-sm">
          주문 번호: <span className="font-mono text-xs bg-gray-100 p-1 rounded">{paymentIntent}</span>
        </p>
        <div className="pt-4">
          <Link
            href="/checkout"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-semibold"
          >
            다시 결제 테스트하기
          </Link>
        </div>
      </div>
    </div>
  );
}