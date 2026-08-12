import Link from "next/link";
import { FileText } from "lucide-react";
import { PRODUCT_LABELS, PRODUCT_PRICES } from "@/lib/products";

const EFFECTIVE_DATE = "2026-08-10";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-6 py-6 sm:px-10">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 shadow-sm">
          <div className="px-6 py-8 sm:px-10">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-300">
              <FileText className="h-4 w-4" aria-hidden={true} />
              Terms of Service
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl text-balance">
              이용약관
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              시행일: {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Section title="제1조 (목적)">
            <p>
              본 약관은 (주)베이컨랩스(이하 "회사")가 제공하는 읽기 진단·학습 리포트 서비스(이하
              "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한
              사항을 규정함을 목적으로 합니다.
            </p>
          </Section>

          <Section title="제2조 (정의)">
            <ul className="list-disc space-y-1 pl-5">
              <li>"이용자"란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원을 말합니다.</li>
              <li>
                "보호자 회원"이란 만 14세 미만 학생(자녀)을 대리하여 본인 명의로 가입하고 학생
                프로필을 등록·관리하는 이용자를 말합니다.
              </li>
              <li>"선생님 회원"이란 클래스를 개설하여 소속 학생들의 학습 결과를 조회·관리하는 이용자를 말합니다.</li>
              <li>
                "유료 서비스"란 프리미엄 리포트, 월 2회 패키지, 선생님 좌석 구독 등 회사가 유상으로
                제공하는 서비스를 말합니다.
              </li>
            </ul>
          </Section>

          <Section title="제3조 (약관의 효력 및 변경)">
            <p>
              본 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다.
              회사는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자
              및 변경사유를 명시하여 최소 7일 전(이용자에게 불리한 변경의 경우 30일 전)부터
              서비스 내 공지사항을 통해 고지합니다.
            </p>
          </Section>

          <Section title="제4조 (서비스의 내용)">
            <ul className="list-disc space-y-1 pl-5">
              <li>읽기(리딩) 테스트를 통한 발음 정확도·읽기 속도·이해도 측정 및 AR 레벨 산정</li>
              <li>학습 리포트 및 프리미엄 리포트(유료) 제공</li>
              <li>선생님을 위한 클래스 개설, 학생 초대 및 결과 조회 기능</li>
              <li>기타 회사가 추가로 개발하거나 제휴를 통해 제공하는 서비스</li>
            </ul>
          </Section>

          <Section title="제5조 (이용계약의 성립)">
            <p>
              이용계약은 이용자가 본 약관 및 개인정보처리방침에 동의하고 회원가입을 신청한 뒤,
              회사가 이를 승낙함으로써 성립합니다. 학생(자녀)의 서비스 이용은 보호자 회원이 본인
              명의로 가입하여 자녀 프로필을 등록·관리하는 방식으로만 가능하며, 만 14세 미만
              아동이 독립적으로 회원가입을 할 수 없습니다.
            </p>
          </Section>

          <Section title="제6조 (이용요금 및 결제)">
            <p>회사가 제공하는 유료 서비스 및 결제 방식은 아래와 같으며, 정확한 금액은 실제 결제 화면에 표시된 금액을 기준으로 합니다.</p>
            <ul className="list-disc space-y-1 pl-5">
              {Object.entries(PRODUCT_LABELS).map(([key, label]) => (
                <li key={key}>
                  {label}: ₩{PRODUCT_PRICES[key]?.toLocaleString()} (1회 결제)
                </li>
              ))}
              <li>선생님 좌석 구독: 등록 학생 수(좌석 수)에 따라 매월 정기 결제되는 구독형 상품</li>
            </ul>
            <p>결제는 결제대행사(Stripe)를 통해 신용·체크카드로 처리됩니다.</p>
          </Section>

          <Section title="제7조 (청약철회 및 환불)">
            <p className="font-medium text-slate-700">가. 단건 결제 상품(프리미엄 리포트 등)</p>
            <p>
              이용자는 결제일로부터 7일 이내에 청약을 철회할 수 있습니다. 다만 「전자상거래 등에서의
              소비자보호에 관한 법률」 제17조 제2항에 따라, 리포트 콘텐츠를 실제로 열람한 경우에는
              콘텐츠 제공이 개시된 것으로 보아 청약철회가 제한될 수 있습니다. 열람 전 환불 요청은
              고객센터로 연락 주시면 지체 없이 처리해 드립니다.
            </p>
            <p className="font-medium text-slate-700">나. 정기구독 상품(선생님 좌석 구독)</p>
            <p>
              구독은 이용자가 마이페이지에서 언제든지 해지할 수 있으며, 해지 시 다음 결제 주기부터
              요금이 청구되지 않습니다. 이미 결제된 당월 이용료는 원칙적으로 환불되지 않으며,
              해지 전까지 서비스를 계속 이용할 수 있습니다. 결제 오류 등 회사의 귀책사유가 있는
              경우 전액 환불합니다.
            </p>
            <p className="font-medium text-slate-700">다. 환불 절차</p>
            <p>
              환불이 확정되면 결제수단과 동일한 방법으로, 영업일 기준 3~5일 이내 환불 처리됩니다.
              환불 문의는 charles.j.h.oh@gmail.com으로 접수해 주시기 바랍니다.
            </p>
          </Section>

          <Section title="제8조 (계약해지 및 이용제한)">
            <p>
              이용자는 언제든지 마이페이지를 통해 이용계약 해지(회원 탈퇴)를 신청할 수 있으며,
              회사는 관련 법령이 정하는 바에 따라 즉시 처리합니다. 회사는 이용자가 타인의
              개인정보를 도용하거나 서비스 운영을 방해하는 등 본 약관을 위반한 경우 사전 통지 후
              이용을 제한하거나 계약을 해지할 수 있습니다.
            </p>
          </Section>

          <Section title="제9조 (회사의 의무)">
            <p>
              회사는 관련 법령과 본 약관이 금지하는 행위를 하지 않으며, 안정적인 서비스 제공을
              위하여 지속적으로 노력합니다. 이용자의 개인정보 보호를 위한 보안 시스템을 갖추고
              개인정보처리방침을 공시하고 준수합니다.
            </p>
          </Section>

          <Section title="제10조 (면책조항)">
            <p>
              회사는 천재지변, 서비스 제공에 필요한 외부 업체(결제대행사, 클라우드·AI 인프라 등)의
              장애 등 회사의 귀책사유 없는 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.
              서비스가 제공하는 읽기 진단 결과 및 AR 레벨은 참고 지표이며, 의학적·교육적 진단을
              대체하지 않습니다.
            </p>
          </Section>

          <Section title="제11조 (분쟁해결 및 관할법원)">
            <p>
              회사와 이용자 간 발생한 분쟁에 대해서는 대한민국 법을 적용하며, 분쟁으로 소송이
              제기될 경우 민사소송법상의 관할법원에 제기합니다.
            </p>
          </Section>

          <div className="border-t border-slate-100 px-6 py-5 text-xs text-slate-400 sm:px-10">
            <Link href="/privacy" className="underline hover:text-slate-600">
              개인정보처리방침 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
