'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

type ConfirmStatus = 'checking' | 'success' | 'error';

const MAX_AUTO_RETRIES = 2;

function SuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const orderId = searchParams.get('orderId');
  const resultId = searchParams.get('resultId');
  const isFreePass = searchParams.get('freePass') === 'true';

  const [status, setStatus] = useState<ConfirmStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('결제 상태를 확인 중입니다...');
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const confirmPayment = useCallback(async () => {
    if (!paymentId && !orderId && !isFreePass) {
      setStatus('error');
      setStatusMessage('주문 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatus('error');
        setStatusMessage('로그인이 필요합니다. 다시 로그인 후 재시도해 주세요.');
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
        setStatus('success');
        setStatusMessage('결제가 성공적으로 확인되었습니다!');
      } else {
        const data = await res.json().catch(() => null);
        setStatus('error');
        setStatusMessage(data?.error || '결제 승인 처리 중 일부 문제가 발생했습니다.');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusMessage('결제 승인 처리 중 에러가 발생했습니다.');
    }
  }, [paymentId, orderId, isFreePass]);

  useEffect(() => {
    confirmPayment();
  }, [confirmPayment]);

  // 결제는 이미 됐는데 confirm 호출만 일시적으로 실패한 경우(네트워크 오류 등)를 구제하기
  // 위해 잠깐 텀을 두고 자동으로 몇 번 더 시도한다. 계속 실패하면 수동 재시도로 넘긴다 —
  // 예전엔 여기서 실패해도 재시도 수단이 전혀 없어서, 이미 결제한 사용자가 다시 결제하는
  // 수밖에 없었다.
  useEffect(() => {
    if (status !== 'error' || autoRetryCount >= MAX_AUTO_RETRIES) return;

    const timer = setTimeout(() => {
      setAutoRetryCount((c) => c + 1);
      setStatus('checking');
      setStatusMessage('결제 확인을 다시 시도하는 중입니다...');
      confirmPayment();
    }, 2000);

    return () => clearTimeout(timer);
  }, [status, autoRetryCount, confirmPayment]);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    setStatus('checking');
    setStatusMessage('결제 확인을 다시 시도하는 중입니다...');
    try {
      await confirmPayment();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-20 p-8 bg-white shadow-lg rounded-2xl text-center">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl ${
          status === 'error' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
        }`}
      >
        {status === 'checking' ? (
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : status === 'error' ? (
          '!'
        ) : (
          '✓'
        )}
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        {status === 'error' ? '결제 확인이 지연되고 있어요' : '결제가 완료되었습니다!'}
      </h1>
      <p className="text-gray-600 mb-6">{statusMessage}</p>

      {status === 'error' && (
        <div className="mb-4 space-y-3">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 leading-relaxed">
            결제 자체는 완료되었을 수 있습니다. 다시 결제하지 마시고 아래 버튼으로 확인을
            재시도해 주세요.
          </p>
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="inline-block w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {isRetrying ? '재시도 중...' : '결제 확인 다시 시도'}
          </button>
        </div>
      )}

      {status === 'success' &&
        (resultId ? (
          <Link
            href={`/premium-report?result_id=${resultId}&unlock=1`}
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
        ))}

      {status === 'error' && (
        <Link
          href="/mypage"
          className="inline-block w-full mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
        >
          마이페이지에서 결제 내역 확인하기
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
