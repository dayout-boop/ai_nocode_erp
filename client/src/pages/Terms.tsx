import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 container py-12 max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="font-display-ko text-3xl font-bold text-gray-900 mb-2">이용약관</h1>
          <p className="text-gray-500 text-sm">두골프(dayoutgolf.com) 서비스 이용약관입니다.</p>
        </div>

        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">제 1장 총칙</h2>

            <h3 className="text-base font-bold text-gray-800 mb-2">제 1조(목적)</h3>
            <p>
              이 약관은 데이아웃(이)가 운영하는 온라인 쇼핑몰(이하 "당사"이라 한다)에서 제공하는 인터넷 관련 서비스(이하 "서비스"라 한다)를 이용함에 있어 사이버 몰과 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
            <p className="text-gray-500 text-sm">※ 「PC통신, 모바일 무선 등을 이용하는 전자거래에 대해서도 그 성질에 반하지 않는 한 이 약관을 준용합니다.」</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제 2조(용어의 정의)</h3>
            <p>① "당사"란 데이아웃(이)가 재화 또는 용역(이하 "재화 등"이라 함)을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 등을 거래할 수 있도록 설정한 가상의 영업장을 말하며, 아울러 온라인 쇼핑몰을 운영하는 사업자의 의미로도 사용합니다.</p>
            <p>② "이용자"란 "당사" 홈페이지에 접속하여 이 약관에 따라 "당사"가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</p>
            <p>③ "회원"이라 함은 "당사"에 개인정보를 제공하여 회원등록을 한 자로서, "당사"의 정보를 지속적으로 제공받으며, "당사"가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</p>
            <p>④ "비회원"이라 함은 회원에 가입하지 않고 "당사"가 제공하는 서비스를 이용하는 자를 말합니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제 3조(약관의 명시와 개정)</h3>
            <p>① "당사"는 이 약관의 내용과 상호 및 대표자 성명, 영업소 소재지, 주소, 전화번호, 모사전송번호, 전자우편주소, 사업자등록번호, 통신판매업신고번호, 개인정보관리책임자 등을 이용자가 쉽게 알 수 있도록 "당사" 홈페이지의 초기 서비스화면(전면)에 게시합니다.</p>
            <p>② "당사"는 이용자가 약관에 동의하기에 앞서 약관에 정하여져 있는 내용 중 청약철회·환불조건 등과 같은 중요한 내용을 이용자가 이해할 수 있도록 별도의 연결화면 또는 팝업화면 등을 제공하여 이용자의 확인을 구하여야 합니다.</p>
            <p>③ "당사"는 전자상거래등에서의소비자보호에관한법률, 약관의규제에관한법률, 전자거래기본법, 전자서명법, 정보통신망이용촉진등에 관한법률, 방문판매등에관한법률, 소비자보호법 등 관련법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</p>
            <p>④ "당사"가 약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행 약관과 함께 "당사" 홈페이지의 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.</p>
            <p>⑤ "당사"가 약관을 개정할 경우에는 그 개정약관은 적용일자 이후에 체결되는 계약에만 적용되고 그 이전에 이미 체결된 계약에 대해서는 개정 전의 약관조항이 그대로 적용됩니다.</p>
            <p>⑥ 이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는 전자상거래등에서의소비자보호에관한법률, 약관의규제등에관한법률, 정부가 제정한 전자상거래 등에서의 소비자보호지침 및 관계법령 또는 상 관례에 따릅니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제 4조(서비스의 제공 및 변경)</h3>
            <p>① "당사"는 다음과 같은 업무를 수행합니다.</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>재화 또는 용역 등에 대한 정보 제공 및 계약의 체결</li>
              <li>계약이 체결된 재화 또는 용역 등의 배송</li>
              <li>기타 "당사"가 정하는 업무</li>
            </ol>
            <p>② "당사"는 재화 또는 용역의 품절 또는 기술적 사양의 변경 등의 경우에는 장차 체결되는 계약에 의해 제공할 재화 또는 용역의 내용을 변경할 수 있습니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제 5조(서비스의 중단)</h3>
            <p>① "당사"는 컴퓨터 등 정보통신설비의 보수 점검·교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>
            <p>② "당사"는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가 입은 손해에 대하여 배상합니다. 단 "당사"에 고의 또는 과실이 없는 경우에는 그러하지 아니합니다.</p>
            <p>③ 사업종목의 전환, 사업의 포기, 업체간 통합 등의 이유로 서비스를 제공할 수 없게 되는 경우에는 "당사"는 제8조에 정한 방법으로 이용자에게 통지하고 당초 "당사"에서 제시한 조건에 따라 소비자에게 보상합니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제 6조(회원가입)</h3>
            <p>① 이용자는 "당사"가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.</p>
            <p>② "당사"는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>가입신청자가 이 약관 제7조제3항에 의하여 이전에 회원자격을 상실한 적이 있는 경우</li>
              <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
              <li>기타 회원으로 등록하는 것이 "당사"의 기술상 현저히 지장이 있다고 판단되는 경우</li>
            </ol>
            <p>③ 회원가입의 성립시기는 "당사"의 승낙이 회원에게 도달한 시점으로 합니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제7조(회원 탈퇴 및 자격 상실 등)</h3>
            <p>① 회원은 "당사"에 언제든지 탈퇴를 요청할 수 있으며 "당사"는 즉시 회원 탈퇴를 처리합니다.</p>
            <p>② 회원이 다음 각 호의 사유에 해당하는 경우, "당사"는 회원자격을 제한 및 정지시킬 수 있습니다.</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>가입 신청 시에 허위 내용을 등록한 경우</li>
              <li>"당사"를 이용하여 구입한 재화 등의 대금, 기타 "당사" 이용에 관련하여 회원이 부담하는 채무를 기일에 지급하지 않는 경우</li>
              <li>다른 사람의 "당사" 이용을 방해하거나 그 정보를 도용하는 등 전자상거래질서를 위협하는 경우</li>
              <li>"당사"를 이용하여 법령 또는 이 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우</li>
            </ol>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제9조(구매신청)</h3>
            <p>"당사" 이용자는 "당사"상에서 다음 또는 이와 유사한 방법에 의하여 구매를 신청하며, "당사"는 이용자가 구매신청을 함에 있어서 다음의 각 내용을 알기 쉽게 제공하여야 합니다.</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>재화 등의 검색 및 선택</li>
              <li>성명, 주소, 전화번호, 전자우편주소(또는 이동전화번호) 등의 입력</li>
              <li>약관내용, 청약철회권이 제한되는 서비스 등의 비용 부담과 관련한 내용에 대한 확인</li>
              <li>이 약관에 동의하고 제3호의 사항을 확인하거나 거부하는 표시</li>
              <li>재화 등의 구매신청 및 이에 관한 확인 또는 "당사"의 확인에 대한 동의</li>
              <li>결제방법의 선택</li>
            </ol>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제13조(환급)</h3>
            <p>"당사"는 이용자가 구매신청 한 재화 등이 품절 등의 사유로 인도 또는 제공을 할 수 없을 때에는 지체 없이 그 사유를 이용자에게 통지하고 사전에 재화 등의 대금을 받은 경우에는 대금을 받은 날부터 2영업일 이내에 환급하거나 환급에 필요한 조치를 취합니다. 다만, 여행상품의 경우 상품의 특성 상 이용자가 출발일 전 모든 예약이 완료된 이후 계약을 해지할 경우 국내(외) 여행표준약관 및 국내(외) 소비자 피해보상규정에 의거 손해 배상액을 공제하고 환불합니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제14조(청약철회 등)</h3>
            <p>① "당사"와 재화 등의 구매에 관한 계약을 체결한 이용자는 수신확인의 통지를 받은 날부터 7일 이내에는 청약의 철회를 할 수 있습니다. 다만, 여행상품의 경우 국내(외) 여행표준약관에 의한 환급기준에 따라 별도의 취소수수료가 부과될 수 있습니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제22조(분쟁해결)</h3>
            <p>① "당사"는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 피해보상처리기구를 설치·운영합니다.</p>
            <p>② "당사"는 이용자로부터 제출되는 불만사항 및 의견은 우선적으로 그 사항을 처리합니다.</p>
            <p>③ "당사"와 이용자간에 발생한 전자상거래 분쟁과 관련하여 이용자의 피해구제신청이 있는 경우에는 공정거래위원회 또는 시·도지사가 의뢰하는 분쟁조정기관의 조정에 따를 수 있습니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제23조(재판권 및 준거법)</h3>
            <p>① "당사"와 이용자간에 발생한 전자상거래 분쟁에 관한 소송은 "당사"가 소재하는 법원의 전속관할로 합니다.</p>
            <p>② "당사"와 이용자간에 제기된 전자상거래 소송에는 한국법을 적용합니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">제24조(특별규정)</h3>
            <p>① 당 약관에 명시되지 않은 사항은 전자거래기본법, 전자서명법, 전자상거래 등에서의 소비자보호에 관한 법률, 기타 관련법령의 규정 및 국내(외) 여행표준약관, 특별약관 등에 의합니다.</p>
          </section>

          <hr className="border-gray-200 my-8" />

          <section className="bg-gray-50 rounded-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">사업자 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
              <div><span className="font-medium text-gray-700">상호:</span> 데이아웃</div>
              <div><span className="font-medium text-gray-700">대표:</span> 허만</div>
              <div className="sm:col-span-2"><span className="font-medium text-gray-700">주소:</span> 서울특별시 광진구 자양로 126, 302호 (구의동, 성지하이츠)</div>
              <div><span className="font-medium text-gray-700">대표번호:</span> <a href="tel:1668-1739" className="text-dogolf-green hover:underline">1668-1739</a></div>
              <div><span className="font-medium text-gray-700">이메일:</span> <a href="mailto:dayout@dayoutgolf.com" className="text-dogolf-green hover:underline">dayout@dayoutgolf.com</a></div>
              <div><span className="font-medium text-gray-700">팩스:</span> 02-6944-9979</div>
              <div><span className="font-medium text-gray-700">사업자등록번호:</span> 104-09-54612</div>
              <div><span className="font-medium text-gray-700">통신판매업신고번호:</span> 제 2022-서울광진-1851호</div>
              <div><span className="font-medium text-gray-700">관광사업자 등록번호:</span> 제2016-000005호</div>
              <div><span className="font-medium text-gray-700">개인정보보호 책임자:</span> 허만</div>
            </div>
          </section>

          <div className="flex items-center gap-4 pt-4 text-sm">
            <Link href="/privacy" className="text-dogolf-green hover:underline font-medium">개인정보처리방침 보기 →</Link>
            <Link href="/" className="text-gray-500 hover:underline">홈으로 돌아가기</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
