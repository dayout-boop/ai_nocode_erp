import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 container py-12 max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="font-display-ko text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
          <p className="text-gray-500 text-sm">두골프(dayoutgolf.com) 개인정보처리방침입니다.</p>
        </div>

        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-6">
          <section>
            <p>
              데이아웃(이하 '당사')는 고객님의 개인정보처리방침을 매우 중요시하며, 『정보통신망 이용촉진 및 정보보호 등에 관한 법률』상의 개인정보보호 규정 및 개인정보보호위원회가 제정한 『개인정보보호법』을 준수하고 있습니다.
            </p>
            <p>
              당사는 개인정보 처리방침을 통하여 귀하께서 제공하시는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며 개인정보보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
            </p>
            <p className="text-gray-500 text-sm">※ 개인정보의 수집, 제공 및 활용에 동의하지 않을 권리가 있으며, 미동의시 회원가입 및 여행서비스의 제공이 제한됩니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보의 수집방법 및 항목</h2>
            <p>당사는 여행 서비스 제공을 위해 필요한 최소한의 개인정보만을 수집합니다.</p>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">1. 회원가입 시</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>[필수] 이메일, 비밀번호 : 이용자식별, 회원서비스제공, 멤버십 혜택 및 각종 이벤트 정보 안내</li>
              <li>[선택] 이름, 생년월일, 성별, 휴대폰번호, 이메일주소 : 이용자식별, 회원서비스제공, 멤버십 혜택 및 각종 이벤트 정보 안내</li>
            </ul>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">2. 여행상품 예약 시</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>성명(국문, 영문), 생년월일, 성별, 여권정보, 비자소지여부, 이메일, 전화번호 : 여행상품 예약 및 상담, 출국가능여부확인</li>
              <li>성명, 생년월일, 성별, 여권번호 : 여행자보험 가입</li>
              <li>성명, 신용카드번호, 유효기간, 계좌번호 : 대금결제, 정산, 환불</li>
            </ul>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">3. 견적신청 시</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>[필수] : 성명, 전화번호, 이메일, 요청사항 내용</li>
              <li>[선택] : 단체명</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보 수집방법</h2>
            <p>당사에서 운영하는 홈페이지와 전화, 팩스 등과 상품예약(구매) 및 그 외 본인 확인, 제휴사로부터의 당사 제공 등의 방법으로 개인정보를 수집합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보의 수집 및 이용목적</h2>
            <p>당사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
            <ol className="list-decimal ml-6 space-y-2">
              <li><strong>서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산:</strong> 여행상품 예약, 여행자보험 가입, 항공권/호텔의 예약, 예약내역의 확인 및 상담, 컨텐츠 제공, 구매 및 요금 결제, 본인인증 및 금융서비스, 환불, 출국가능여부파악 등</li>
              <li><strong>고객 관리:</strong> 고객관리 및 서비스 이용에 따른 본인확인, 개인 식별, 불량회원의 부정 이용 방지와 비인가 사용 방지, 가입 의사 확인, 이용 및 이용횟수 제한, 연령확인, 분쟁조정을 위한 기록보존, 불만처리 등 민원처리, 고지사항 전달 등</li>
              <li><strong>신규서비스 및 마케팅, 광고에 활용:</strong> 인구통계학적 특성에 따른 서비스 제공 및 광고 게재, 이벤트·신상품 등 광고성 정보 전달 및 참여기회 제공, 접속 빈도 파악, 서비스 이용에 대한 통계, 신규 및 제휴 비즈니스 관련 서비스 제공 및 각종 마케팅 활동 등</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보의 이용, 보유기간 및 파기</h2>
            <p>당사는 고객님의 개인정보를 수집목적 또는 제공받은 목적이 달성되거나 고객이 탈퇴를 요청하는 경우에는 해당 개인의 정보는 재생할 수 없는 기술적 방법을 통해 삭제되며, 어떠한 용도로도 열람 또는 이용할 수 없도록 파기됩니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 아래와 같이 관계법령에서 정한 일정한 기간 동안 회원 정보를 보관합니다.</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>계약 또는 청약철회 등에 관한 기록: <strong>5년</strong> (전자상거래등에서의 소비자보호에 관한 법률)</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: <strong>5년</strong> (전자상거래등에서의 소비자보호에 관한 법률)</li>
              <li>소비자의 불만 또는 분쟁처리에 관한 기록: <strong>3년</strong> (전자상거래등에서의 소비자보호에 관한 법률)</li>
              <li>표시·광고에 관한 기록: <strong>6개월</strong> (전자상거래등에서의 소비자보호에 관한 법률)</li>
            </ul>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">파기방법</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>종이에 출력된 개인정보: 분쇄기를 이용하여 분쇄</li>
              <li>전자적 파일 형태로 저장된 개인정보: 개인정보는 남기지 않으며, 기록을 재생할 수 없는 방법을 통하여 기록 삭제</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보의 열람, 정정, 동의 철회</h2>
            <p>당사의 고객님 개인정보 열람 및 정정을 위해서는 홈페이지의 마이페이지 내 회원정보 수정을 클릭하여 열람 또는 정정하실 수 있습니다. 당사는 개인정보에 대한 열람증명 또는 정정을 요구하는 경우 성실하게 대응합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보 자동수집 장치의 설치, 운영 및 그 거부에 관한 사항</h2>
            <p>당사는 고객님의 정보를 수시로 저장하고 찾아내는 '쿠키(cookie)' 등을 운용합니다. 쿠키란 당사의 웹사이트를 운영하는데 이용되는 서버가 고객님의 브라우저에 보내는 아주 작은 텍스트 파일로서 고객님의 컴퓨터 하드디스크에 저장됩니다.</p>
            <p>고객님은 쿠키 설치에 대한 선택권을 가지고 있습니다. 따라서, 고객님은 웹브라우저에서 옵션을 설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 아니면 모든 쿠키의 저장을 거부할 수도 있습니다.</p>
            <p className="text-gray-500 text-sm">단, 고객님께서 쿠키 설치를 거부하였을 경우 서비스 제공에 어려움이 있을 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보보호를 위한 기술 및 관리대책</h2>

            <h3 className="text-base font-bold text-gray-800 mb-2">가. 기술적 대책</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>고객님의 개인정보는 비밀번호에 의해 보호되며 파일 및 전송데이터를 암호화하거나 파일 잠금기능(Lock)을 사용하여 중요한 데이터는 별도의 보안기능을 통해 보호되고 있습니다.</li>
              <li>당사는 백신프로그램을 이용하여 컴퓨터바이러스에 의한 피해를 방지하기 위한 조치를 취하고 있습니다.</li>
              <li>당사는 암호알고리즘을 이용하여 네트워크상의 개인정보를 안전하게 전송할 수 있는 보안장치를 채택하고 있습니다.</li>
              <li>해킹 등 외부침입에 대비하여 각 서버마다 침입차단시스템 및 취약점 분석시스템 등을 이용하여 보안에 만전을 기하고 있습니다.</li>
            </ul>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-4">나. 관리적 대책</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>당사는 회원님의 개인정보에 대한 접근권한을 최소한의 인원으로 제한하고 있습니다.</li>
              <li>개인정보를 취급하는 직원을 대상으로 새로운 보안 기술 습득 및 개인정보 보호 의무 등에 관해 정기적인 사내 교육 및 외부 위탁교육을 실시하고 있습니다.</li>
              <li>입사 시 전 직원의 보안서약서를 통하여 사람에 의한 정보유출을 사전에 방지하고 있습니다.</li>
              <li>개인정보와 일반 데이터를 혼합하여 보관하지 않고 별도의 서버를 통해 분리하여 보관하고 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">개인정보에 관한 민원서비스</h2>
            <p>개인정보관리책임자는 당사 홈페이지 하단 개인정보처리자 또는 대표자로 안내하고 있습니다.</p>
            <div className="bg-gray-50 rounded-lg p-4 mt-3 text-sm">
              <p><strong>개인정보보호 책임자:</strong> 허만</p>
              <p><strong>연락처:</strong> <a href="tel:1668-1739" className="text-dogolf-green hover:underline">1668-1739</a></p>
              <p><strong>이메일:</strong> <a href="mailto:dayout@dayoutgolf.com" className="text-dogolf-green hover:underline">dayout@dayoutgolf.com</a></p>
            </div>
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
            <Link href="/terms" className="text-dogolf-green hover:underline font-medium">이용약관 보기 →</Link>
            <Link href="/" className="text-gray-500 hover:underline">홈으로 돌아가기</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
