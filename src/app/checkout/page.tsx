'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as PortOne from '@portone/browser-sdk/v2';
import { supabase } from '@/lib/supabase-client';
import { PRODUCT_PRICES, PRODUCT_LABELS } from '@/lib/products';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productType = searchParams.get('type') === 'package' ? 'package_2x_month' : 'single_report';
  const resultId = productType === 'single_report' ? searchParams.get('resultId') : null;
  // 패키지 결제는 주문에 result_id를 실어 보내지 않지만(서버가 어차피 무시함), 특정
  // 리포트를 잠금 해제하려고 들어온 사용자는 결제 후 그 리포트로 돌아가야 하므로
  // 복귀 경로만 별도로 항상 보존한다.
  const returnResultId = searchParams.get('resultId');
  const basePrice = PRODUCT_PRICES[productType];

  const [couponInput, setCouponInput] = useState('');
  const [priceInfo, setPriceInfo] = useState({ original: basePrice, final: basePrice, discountAmount: 0 });
  const [couponMessage, setCouponMessage] = useState('');
  const [isFreePass, setIsFreePass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [ready, setReady] = useState(false);

  // 💥 즉시 반영되는 Ref 객체로 중복 호출 및 orderId 관리
  const orderIdRef = useRef<string | null>(null);
  const isCallingApiRef = useRef<boolean>(false);

  const fetchOrder = async (coupon = '') => {
    // 이미 API 호출이 진행 중이라면 동시 호출 차단!
    if (isCallingApiRef.current) return;
    isCallingApiRef.current = true;

    setIsLoading(true);
    setReady(false);
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

      const discount = data.discountAmount ?? 0;

      setPriceInfo({
        original: data.originalAmount ?? basePrice,
        final: data.finalAmount ?? basePrice,
        discountAmount: discount,
      });
      setReady(true);

      if (coupon.trim() !== '') {
        if (discount > 0) {
          setCouponMessage('🎉 쿠폰이 성공적으로 적용되었습니다!');
        } else {
          setCouponMessage('❌ 유효하지 않거나 만료된 쿠폰입니다.');
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
    fetchOrder();
  }, []);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    fetchOrder(couponInput);
  };

  const handleFreePassSubmit = () => {
    const url = new URL('/checkout/success', window.location.origin);
    url.searchParams.set('freePass', 'true');
    if (orderIdRef.current) url.searchParams.set('orderId', orderIdRef.current);
    if (returnResultId) url.searchParams.set('resultId', returnResultId);
    router.push(url.pathname + url.search);
  };

  const handlePay = async () => {
    if (!orderIdRef.current || isPaying) return;
    setIsPaying(true);
    setPayError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setPayError('로그인이 필요합니다.');
        return;
      }

      const paymentId = `report-${orderIdRef.current}-${crypto.randomUUID().slice(0, 8)}`;

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId,
        orderName: PRODUCT_LABELS[productType] || productType,
        totalAmount: priceInfo.final,
        currency: 'KRW',
        payMethod: 'CARD',
        customer: session.user.email ? { email: session.user.email } : undefined,
      });

      if (!response || response.code) {
        setPayError(response?.message || '결제가 취소되었거나 실패했습니다.');
        return;
      }

      const url = new URL('/checkout/success', window.location.origin);
      url.searchParams.set('paymentId', paymentId);
      url.searchParams.set('orderId', orderIdRef.current);
      if (returnResultId) url.searchParams.set('resultId', returnResultId);
      router.push(url.pathname + url.search);
    } catch (err) {
      console.error(err);
      setPayError('결제 중 오류가 발생했습니다.');
    } finally {
      setIsPaying(false);
    }
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

      {/* 결제 버튼 또는 무료 결제 완료 버튼 */}
      {isFreePass ? (
        <button
          type="button"
          onClick={handleFreePassSubmit}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          0원 결제 완료 및 시작하기 🎉
        </button>
      ) : ready ? (
        <div className="space-y-3">
          {payError && <p className="text-red-500 text-sm">{payError}</p>}
          <button
            type="button"
            onClick={handlePay}
            disabled={isPaying}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPaying ? '결제 처리 중...' : `₩${priceInfo.final.toLocaleString()} 결제하기`}
          </button>
        </div>
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
