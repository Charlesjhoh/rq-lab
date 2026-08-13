'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase-client';
import { PRODUCT_PRICES, PRODUCT_LABELS } from '@/lib/products';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm({ finalAmount, resultId }: { finalAmount: number; resultId: string | null }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage('');

    const returnUrl = new URL('/checkout/success', window.location.origin);
    if (resultId) returnUrl.searchParams.set('resultId', resultId);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl.toString(),
      },
    });

    if (error) {
      setErrorMessage(error.message || '결제 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
      <PaymentElement />
      {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? '결제 처리 중...' : `₩${finalAmount.toLocaleString()} 결제하기`}
      </button>
    </form>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productType = searchParams.get('type') === 'package' ? 'package_2x_month' : 'single_report';
  const resultId = productType === 'single_report' ? searchParams.get('resultId') : null;
  const basePrice = PRODUCT_PRICES[productType];

  const [clientSecret, setClientSecret] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [priceInfo, setPriceInfo] = useState({ original: basePrice, final: basePrice, discountAmount: 0 });
  const [couponMessage, setCouponMessage] = useState('');
  const [isFreePass, setIsFreePass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 💥 [핵심] 즉시 반영되는 Ref 객체로 중복 호출 및 orderId 관리
  const orderIdRef = useRef<string | null>(null);
  const isCallingApiRef = useRef<boolean>(false);

  const fetchPaymentIntent = async (coupon = '') => {
    // 이미 API 호출이 진행 중이라면 동시 호출 차단!
    if (isCallingApiRef.current) return;
    isCallingApiRef.current = true;

    setIsLoading(true);
    setClientSecret('');
    setIsFreePass(false);
    setCouponMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setCouponMessage('❌ 로그인이 필요합니다.');
        return;
      }

      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productType,
          resultId,
          couponCode: coupon.trim(),
          orderId: orderIdRef.current, // 👈 Ref의 최신 orderId 전달
        }),
      });

      const data = await res.json();

      // 생성/조회된 orderId를 즉시 Ref에 저장
      if (data.orderId) {
        orderIdRef.current = data.orderId;
      }

      if (!res.ok) {
        setCouponMessage(`❌ ${data.error || '결제 정보를 불러오지 못했습니다.'}`);
        setPriceInfo({ original: basePrice, final: basePrice, discountAmount: 0 });
        return;
      }

      // 100% 할인 (0원 결제) 처리
      if (data.freePass || data.isFreePass || data.finalAmount === 0) {
        setIsFreePass(true);
        setPriceInfo({
          original: data.originalAmount || basePrice,
          final: 0,
          discountAmount: data.originalAmount || basePrice,
        });
        setCouponMessage('🎉 100% 할인 쿠폰이 적용되었습니다! (무료 이용)');
        return;
      }

      // 일반 Stripe 결제 세션
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        const discount = data.discountAmount ?? 0;

        setPriceInfo({
          original: data.originalAmount ?? basePrice,
          final: data.finalAmount ?? basePrice,
          discountAmount: discount,
        });

        if (coupon.trim() !== '') {
          if (discount > 0) {
            setCouponMessage('🎉 쿠폰이 성공적으로 적용되었습니다!');
          } else {
            setCouponMessage('❌ 유효하지 않거나 만료된 쿠폰입니다.');
          }
        }
      }
    } catch (err) {
      console.error(err);
      setCouponMessage('❌ 서버 통신 중 에러가 발생했습니다.');
      setPriceInfo({ original: basePrice, final: basePrice, discountAmount: 0 });
    } finally {
      setIsLoading(false);
      isCallingApiRef.current = false; // 호출 완료 후 해제
    }
  };

  useEffect(() => {
    fetchPaymentIntent();
  }, []);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    fetchPaymentIntent(couponInput);
  };

  const handleFreePassSubmit = () => {
    const url = new URL('/checkout/success', window.location.origin);
    url.searchParams.set('freePass', 'true');
    if (orderIdRef.current) url.searchParams.set('orderId', orderIdRef.current);
    if (resultId) url.searchParams.set('resultId', resultId);
    router.push(url.pathname + url.search);
  };

  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-white shadow-md rounded-xl">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">{PRODUCT_LABELS[productType]}</h1>

      {/* 쿠폰 입력 영역 */}
      <form onSubmit={handleApplyCoupon} className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">쿠폰 코드</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="쿠폰 코드를 입력하세요"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
          />
          <button
            type="submit"
            disabled={isLoading || !couponInput.trim()}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 disabled:opacity-50"
          >
            {isLoading ? '확인 중...' : '적용'}
          </button>
        </div>
        {couponMessage && (
          <p className={`text-sm mt-2 ${priceInfo.discountAmount > 0 || isFreePass ? 'text-green-600 font-medium' : 'text-red-500'}`}>
            {couponMessage}
          </p>
        )}
      </form>

      {/* 금액 표시 */}
      <div className="border-t border-b py-3 mb-4 space-y-1 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>기존 금액</span>
          <span className={priceInfo.discountAmount > 0 || isFreePass ? 'line-through' : ''}>
            ₩{priceInfo.original.toLocaleString()}
          </span>
        </div>
        {(priceInfo.discountAmount > 0 || isFreePass) && (
          <div className="flex justify-between font-bold text-green-600">
            <span>할인 금액</span>
            <span>-₩{priceInfo.discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 text-gray-800 border-t">
          <span>최종 결제 금액</span>
          <span>₩{priceInfo.final.toLocaleString()}</span>
        </div>
      </div>

      {/* Stripe 카드 결제 Form 또는 무료 결제 완료 버튼 */}
      {isFreePass ? (
        <button
          type="button"
          onClick={handleFreePassSubmit}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          0원 결제 완료 및 시작하기 🎉
        </button>
      ) : clientSecret ? (
        <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm finalAmount={priceInfo.final} resultId={resultId} />
        </Elements>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {isLoading ? '결제 정보를 계산 중입니다...' : '결제 정보를 불러오는 중...'}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-gray-400">
        결제 진행 시{' '}
        <Link href="/terms" className="underline hover:text-gray-600">
          이용약관
        </Link>
        (청약철회·환불 규정 포함)에 동의한 것으로 간주됩니다.
      </p>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="text-center my-20 text-gray-500">로딩 중...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}