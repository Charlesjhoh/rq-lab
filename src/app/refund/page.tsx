import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { PRODUCT_PRICES } from "@/lib/products";

const EFFECTIVE_DATE = "2026-10-30";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-6 py-6 sm:px-10">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 shadow-sm">
          <div className="px-6 py-8 sm:px-10">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-300">
              <RotateCcw className="h-4 w-4" aria-hidden={true} />
              Exchange &amp; Refund Policy
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl text-balance">
              교환 및 환불정책
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              시행일: {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-6 text-sm leading-relaxed text-slate-600 sm:px-10">
            (주)베이컨랩스(이하 &quot;회사&quot;)가 제공하는 유료 서비스의 교환 및 환불 기준은 아래와 같으며,
            본 정책은{" "}
            <Link href="/terms" className="underline hover:text-slate-900">
              이용약관
            </Link>{" "}
            제7조(청약철회, 교환 및 환불)와 동일한 내용입니다.
          </div>

          <Section title="1. 교환">
            <p>
              회사가 제공하는 유료 서비스(프리미엄 리포트, 월 2회 패키지, 선생님 좌석 구독)는 온라인으로
              제공되는 디지털 콘텐츠로, 실물 상품과 같은 교환 대상이 아닙니다. 다른 상품으로 변경을
              원하시는 경우 아래 환불 기준에 따라 기존 결제를 환불받으신 뒤 새로 구매해 주시기 바랍니다.
            </p>
            <p>
              다만 회사의 귀책사유(결제 오류, 리포트 생성 오류, 콘텐츠 하자 등)로 정상적인 서비스를
              제공받지 못한 경우, 이용자의 선택에 따라 동일 상품을 다시 제공하거나 전액 환불합니다.
            </p>
          </Section>

          <Section title="2. 단건 결제 상품(프리미엄 리포트, 월 2회 패키지)">
            <p>
              이용자는 결제일로부터 7일 이내에 청약을 철회할 수 있습니다. 다만 「전자상거래 등에서의
              소비자보호에 관한 법률」 제17조 제2항에 따라, 리포트 콘텐츠를 실제로 열람한 경우에는
              콘텐츠 제공이 개시된 것으로 보아 청약철회가 제한될 수 있습니다. 열람 전 환불 요청은
              고객센터로 연락 주시면 지체 없이 처리해 드립니다.
            </p>
            <p>
              월 2회 패키지는 크레딧 단위로 나누어 제공되는 상품으로, 결제일로부터 7일 이내에는
              사용하지 않은 크레딧에 대해 청약을 철회할 수 있습니다. 이 경우 결제금액에서 사용한
              크레딧 수 × 프리미엄 리포트 1회 열람 정가(₩{PRODUCT_PRICES.single_report.toLocaleString()})를
              뺀 금액을 환불합니다(차감액이 결제금액 이상이면 환불액은 없습니다).
            </p>
            <p>
              예) 월 2회 패키지(₩{PRODUCT_PRICES.package_2x_month.toLocaleString()}) 결제 후 크레딧
              1개 사용 → ₩{PRODUCT_PRICES.package_2x_month.toLocaleString()} − ₩
              {PRODUCT_PRICES.single_report.toLocaleString()} = ₩
              {(PRODUCT_PRICES.package_2x_month - PRODUCT_PRICES.single_report).toLocaleString()} 환불
            </p>
          </Section>

          <Section title="3. 정기구독 상품(선생님 좌석 구독)">
            <p>
              구독은 이용자가 마이페이지에서 언제든지 해지할 수 있으며, 해지 시 다음 결제 주기부터
              요금이 청구되지 않습니다. 이미 결제된 당월 이용료는 원칙적으로 환불되지 않으며,
              해지 전까지 서비스를 계속 이용할 수 있습니다. 결제 오류 등 회사의 귀책사유가 있는
              경우 전액 환불합니다.
            </p>
          </Section>

          <Section title="4. 환불 절차">
            <p>
              환불이 확정되면 결제수단과 동일한 방법으로, 영업일 기준 3~5일 이내 환불 처리됩니다.
              환불 및 교환 문의는 고객센터(070-4519-5313) 또는 charles.j.h.oh@gmail.com으로 접수해
              주시기 바랍니다.
            </p>
          </Section>

          <div className="border-t border-slate-100 px-6 py-5 text-xs text-slate-400 sm:px-10">
            <Link href="/terms" className="underline hover:text-slate-600">
              이용약관 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
