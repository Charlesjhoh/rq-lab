'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

function SuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const orderId = searchParams.get('orderId');
  const resultId = searchParams.get('resultId');
  const isFreePass = searchParams.get('freePass') === 'true';

  const [isUpdating, setIsUpdating] = useState(true);
  const [statusMessage, setStatusMessage] = useState('결제 상태를 확인 중입니다...');

  useEffect(() => {
    const confirmPayment = async () => {
      if (!paymentId && !orderId && !isFreePass) {
        setIsUpdating(false);
        setStatusMessage('주문 정보를 찾을 수 없습니다.');
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setIsUpdating(false);
          setStatusMessage('로그인이 필요합니다. 다시 로그인해 주세요.');
          return;
        }

        // 백엔드 confirm API 호출하여 엔타이틀먼트(패키지 크레딧/리포트 잠금 해제) 부여
        const res = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            paymentId: paymentId,
            orderId: orderId,
            isFreePass: isFreePass,
          }),
        });

        if (res.ok) {
          setStatusMessage('결제가 성공적으로 확인되었습니다!');
        } else {
          setStatusMessage('결제 승인 처리 중 일부 문제가 발생했습니다.');
        }
      } catch (err) {
        console.error(err);
        setStatusMessage('결제 승인 처리 중 에러가 발생했습니다.');
      } finally {
        setIsUpdating(false);
      }
    };

    confirmPayment();
  }, [paymentId, orderId, isFreePass]);

  return (
    <div className="max-w-md mx-auto my-20 p-8 bg-white shadow-lg rounded-2xl text-center">
      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">결제가 완료되었습니다!</h1>
      <p className="text-gray-600 mb-6">
        {isUpdating ? '주문 정보를 업데이트 중입니다...' : statusMessage}
      </p>

      {resultId ? (
        <Link
          href={`/premium-report?result_id=${resultId}`}
          className="inline-block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          리포트 보러가기
        </Link>
      ) : (
        <Link
          href="/mypage"
          className="inline-block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          마이페이지로 가기
        </Link>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="text-center my-20">로딩 중...</div>}>
      <SuccessContent />
    </Suspense>
  );
}