import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const EFFECTIVE_DATE = "2026-08-10";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-6 py-6 sm:px-10">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 shadow-sm">
          <div className="px-6 py-8 sm:px-10">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-300">
              <ShieldCheck className="h-4 w-4" aria-hidden={true} />
              Privacy Policy
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl text-balance">
              개인정보처리방침
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              시행일: {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-6 text-sm leading-relaxed text-slate-600 sm:px-10">
            (주)베이컨랩스(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보보호법」 등 관련 법령을
            준수하고 있습니다. 회사는 본 개인정보처리방침을 통해 이용자가 제공하는 개인정보가
            어떠한 목적과 방식으로 이용되고 있으며, 개인정보보호를 위해 어떠한 조치가 취해지고
            있는지 알려드립니다.
          </div>

          <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
            <p className="font-medium text-slate-700">가. 회원가입 시 (보호자 본인)</p>
            <p>이메일, 비밀번호, 보호자(학부모) 이름</p>
            <p className="font-medium text-slate-700">나. 학생(자녀) 프로필 등록 시</p>
            <p>
              학생 이름, 생년월일 — 위 정보는 보호자가 본인 계정으로 직접 입력하여 등록하며,
              학생이 별도로 회원가입하지 않습니다. 자세한 내용은 「7. 아동 개인정보 보호」를
              참고해 주세요.
            </p>
            <p className="font-medium text-slate-700">다. 선생님 회원가입 시</p>
            <p>이메일, 비밀번호, 표시 이름, 소속 클래스 운영에 필요한 정보</p>
            <p className="font-medium text-slate-700">라. 서비스 이용 과정에서 자동 수집</p>
            <p>
              읽기 테스트 음성 녹음 파일(발음·속도 평가 및 이해도 확인 목적), 텍스트 답변(구술
              회상 내용), 테스트 결과(속도·정확도·이해도·AR 레벨 등), 접속 로그, 쿠키, 서비스
              이용기록
            </p>
            <p className="font-medium text-slate-700">마. 결제 시</p>
            <p>
              결제 상품 정보, 결제 금액, 주문 내역 — 카드번호 등 결제 수단 정보 자체는 회사
              서버에 저장되지 않으며, 결제대행사(포트원, 토스페이먼츠)가 직접 처리·보관합니다.
            </p>
          </Section>

          <Section title="2. 개인정보의 수집 및 이용 목적">
            <ul className="list-disc space-y-1 pl-5">
              <li>회원 가입 의사 확인, 본인 확인, 회원 관리</li>
              <li>읽기 테스트 채점(발음·속도·정확도·이해도 평가) 및 AR 레벨 산정</li>
              <li>학습 리포트·프리미엄 리포트 생성 및 제공</li>
              <li>선생님-학생 클래스 매칭 및 클래스 단위 결과 조회 제공</li>
              <li>결제, 구독(좌석), 쿠폰·크레딧 처리 및 결제 기록 관리</li>
              <li>고객문의 응대, 공지사항 전달, 서비스 개선을 위한 통계 분석</li>
            </ul>
          </Section>

          <Section title="3. 개인정보의 보유 및 이용 기간">
            <p>
              회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이
              파기합니다. 다만 관계 법령에 따라 보존할 필요가 있는 경우 아래와 같이 일정 기간
              보관합니다.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한
                법률)
              </li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (동법)</li>
              <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년 (동법)</li>
              <li>회원 탈퇴 시: 위 법정 보관 항목을 제외한 나머지 개인정보는 즉시 파기</li>
            </ul>
          </Section>

          <Section title="4. 개인정보의 제3자 제공">
            <p>
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가
              사전에 동의하거나 법령에 특별한 규정이 있는 경우 예외로 합니다.
            </p>
          </Section>

          <Section title="5. 개인정보 처리의 위탁">
            <p>
              회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 외부 전문업체에
              위탁하고 있습니다.
            </p>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[420px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">수탁업체</th>
                    <th className="py-2 pr-4 font-medium">위탁 업무</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 pr-4">Supabase Inc.</td>
                    <td className="py-2 pr-4">회원 인증 및 데이터베이스 호스팅</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">포트원 주식회사</td>
                    <td className="py-2 pr-4">결제 연동 및 정기구독(좌석) 처리 중개</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">토스페이먼츠 주식회사</td>
                    <td className="py-2 pr-4">신용·체크카드 결제 승인·처리</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Microsoft (Azure Cognitive Services)</td>
                    <td className="py-2 pr-4">읽기 음성의 발음·속도 평가(음성 분석)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">OpenAI</td>
                    <td className="py-2 pr-4">구술 회상 답변의 이해도 채점 및 AI 코멘트 생성</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2">
              회사는 위탁계약 체결 시 개인정보보호법 제26조에 따라 위탁업무 수행목적 외
              개인정보 처리금지, 기술적·관리적 보호조치 등을 계약서 등에 명시하고 있습니다.
            </p>
          </Section>

          <Section title="6. 아동의 개인정보 보호">
            <p>
              본 서비스는 만 14세 미만 아동(학생)이 직접 회원가입을 하지 않으며, 보호자(학부모)가
              본인 명의로 회원가입한 뒤 자녀의 정보를 직접 입력하여 학생 프로필을 생성하는
              방식으로 운영됩니다. 즉 학생 개인정보의 수집 주체는 보호자이며, 회사는 보호자가
              입력한 정보를 바탕으로 서비스를 제공합니다. 보호자는 언제든지 마이페이지에서 등록한
              자녀 정보의 열람·정정·삭제를 요청할 수 있습니다.
            </p>
          </Section>

          <Section title="7. 이용자의 권리와 행사 방법">
            <p>
              이용자(보호자)는 언제든지 자신 및 등록한 자녀의 개인정보를 조회·수정할 수 있으며,
              회원 탈퇴를 통해 수집·이용 동의를 철회할 수 있습니다. 개인정보 열람, 정정, 삭제,
              처리정지를 원하실 경우 아래 문의처로 연락해 주시면 지체 없이 조치하겠습니다.
            </p>
          </Section>

          <Section title="8. 개인정보의 안전성 확보 조치">
            <ul className="list-disc space-y-1 pl-5">
              <li>비밀번호는 암호화하여 저장하며, 본인만 알고 있음</li>
              <li>결제 수단 정보는 회사 서버에 저장하지 않고 PCI-DSS를 준수하는 결제대행사가 처리</li>
              <li>개인정보에 대한 접근 권한을 최소한의 인원으로 제한하고 접근 통제</li>
            </ul>
          </Section>

          <Section title="9. 개인정보 보호책임자">
            <p>
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 이용자의 불만 처리 및 피해
              구제 등을 위해 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>성명: 오정현</li>
              <li>이메일: charles.j.h.oh@gmail.com</li>
            </ul>
          </Section>

          <Section title="10. 고지의 의무">
            <p>
              본 개인정보처리방침의 내용이 추가, 삭제 및 수정이 있을 시에는 시행 최소 7일 전에
              서비스 내 공지사항을 통해 고지할 것입니다.
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
