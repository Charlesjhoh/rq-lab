'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Stripe 객체 초기화 (공개키 사용)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// 실제 카드 입력을 처리하는 내부 폼 컴포넌트
function PaymentForm({ finalAmount }: { finalAmount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage('');

    // Stripe 결제 승인 요청
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`, // 결제 완료 후 이동할 페이지
      },
    });

    if (error) {
      setErrorMessage(error.message || '결제 중 오류가 발생했습니다.');
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMessage && <div className="text-red-500 text-sm">{errorMessage}</div>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-blue-600 text-white py-3 rounded-md font-bold disabled:opacity-50"
      >
        {isProcessing ? '결제 처리 중...' : `$${finalAmount} 결제하기`}
      </button>
    </form>
  );
}

// 쿠폰 입력 + Stripe Elements 감싸는 메인 결제 컴포넌트
export default function CheckoutForm({
  originalPrice = 100,
}: {
  originalPrice?: number;
}) {
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(originalPrice);
  const [couponMessage, setCouponMessage] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // 1. 쿠폰 적용 버튼 클릭 시
  const handleApplyCoupon = async () => {
    setCouponMessage('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, originalAmount: originalPrice }),
      });
      const data = await res.json();

      if (data.isValid) {
        setDiscountAmount(data.calculation.discountAmount);
        setFinalAmount(data.calculation.finalAmount);
        setCouponMessage(`✅ ${data.message}`);
      } else {
        setCouponMessage(`❌ ${data.message}`);
      }
    } catch (err) {
      setCouponMessage('❌ 쿠폰 조회 중 오류가 발생했습니다.');
    }
  };

  // 2. Stripe 결제 세션 시작 버튼 클릭 시 (clientSecret 생성)
  const handleStartPayment = async () => {
    try {
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          currency: 'usd',
          couponCode: couponCode || null,
        }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
    } catch (err) {
      alert('결제창을 불러오는 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md space-y-6">
      <h2 className="text-xl font-bold">수강료 결제</h2>

      {/* 금액 표시 영역 */}
      <div className="border-b pb-4 space-y-2">
        <div className="flex justify-between">
          <span>원래 금액:</span>
          <span>${originalPrice}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>쿠폰 할인:</span>
            <span>-${discountAmount}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t pt-2">
          <span>최종 결제 금액:</span>
          <span>${finalAmount}</span>
        </div>
      </div>

      {/* 쿠폰 입력 영역 */}
      {!clientSecret && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">쿠폰 코드 입력</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="예: GGUG_TEST_10"
              className="flex-1 border p-2 rounded-md"
            />
            <button
              onClick={handleApplyCoupon}
              className="bg-gray-800 text-white px-4 py-2 rounded-md"
            >
              적용
            </button>
          </div>
          {couponMessage && <p className="text-sm mt-1">{couponMessage}</p>}

          <button
            onClick={handleStartPayment}
            className="w-full mt-4 bg-green-600 text-white py-3 rounded-md font-bold"
          >
            결제 진행하기
          </button>
        </div>
      )}

      {/* Stripe 카드 입력 폼 (clientSecret 생성 시 출력) */}
      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm finalAmount={finalAmount} />
        </Elements>
      )}
    </div>
  );
}