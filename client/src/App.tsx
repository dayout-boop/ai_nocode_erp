import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Packages from "./pages/Packages";
import Gallery from "./pages/Gallery";
import Notice from "./pages/Notice";
import Inquiry from './pages/Inquiry';
import PackageDetail from './pages/PackageDetail';

// ERP Layout (handles all /erp/* routing internally)
import ERPLayout from "./components/ERPLayout";
import ERPLogin from "./pages/erp/ERPLogin";

// Other Pages
import EstimateView from "./pages/EstimateView";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

// Partner Pages
import PartnerDashboard from "./pages/Partner/PartnerDashboard";
import PartnerChat from "./pages/Partner/PartnerChat";
import PartnerOnboarding from "./pages/PartnerOnboarding";
import PartnerMyPage from "./pages/Partner/PartnerMyPage";
import PartnerStaffLogin from "./pages/Partner/PartnerStaffLogin";
import PartnerLogin from "./pages/Partner/PartnerLogin";
import PartnerResetPassword from "./pages/Partner/PartnerResetPassword";
import PartnerCustomLogin from "./pages/Partner/PartnerCustomLogin";
import Pricing from "./pages/Pricing";

// 투어커뮤니케이션 파트너 랜딩페이지
import PartnerLandingPage from "./pages/PartnerLanding/PartnerLandingApp";

function Router() {
  // partner.dayoutgolf.com 접속 시 파트너 랜딩페이지로 클라이언트 사이드 리다이렉트
  if (typeof window !== 'undefined' && window.location.hostname === 'partner.dayoutgolf.com') {
    window.location.replace('https://dogolf-tour-dkz3fsmp.manus.space/partner-landing');
    return null;
  }
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* 프론트 사이트 */}
      <Route path={"/"} component={Home} />
      <Route path={"/packages"} component={Packages} />
      <Route path={"/packages/detail/:id"} component={PackageDetail} />
      <Route path={"/packages/:destination"} component={Packages} />
      <Route path={"/gallery"} component={Gallery} />
      <Route path={"/notice"} component={Notice} />
      <Route path={"/inquiry"} component={Inquiry} />

      {/* ERP 관리자 백오피스 - ERPLayout이 내부 라우팅 처리 */}
      <Route path={"/erp/login"} component={ERPLogin} />
      <Route path={"/erp"} nest component={ERPLayout} />

      {/* /admin → /erp 리다이렉트 */}
      <Route path={"/admin"} component={() => { window.location.replace("/erp"); return null; }} />
      <Route path={"/admin/:rest*"} component={() => { window.location.replace("/erp"); return null; }} />

      {/* 이용약관 / 개인정보처리방침 */}
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />

      {/* 기타 */}
      <Route path={"/estimate/:token"} component={EstimateView} />

      {/* 파트너 센터 */}
      <Route path={"/partner"} component={PartnerDashboard} />
      <Route path={"/partner/login"} component={PartnerLogin} />
      <Route path={"/partner/chat"} component={PartnerChat} />

      {/* 파트너 신규 가입 신청 (공개) */}
      <Route path={"/partner/join"} component={PartnerOnboarding} />
      {/* 파트너 마이페이지 (OCR 결과 수정 + 하위 담당자 관리) */}
      <Route path={"/partner/my"} component={PartnerMyPage} />
      {/* 하위 담당자 로그인 */}
      <Route path={"/partner/staff/login"} component={PartnerStaffLogin} />
      {/* 비밀번호 재설정 */}
      <Route path={"/partner/reset-password"} component={PartnerResetPassword} />
      {/* 커스텀 OAuth 로그인 */}
      <Route path={"/partner/custom-login"} component={PartnerCustomLogin} />

      {/* 구독 플랜 페이지 */}
      <Route path={"/pricing"} component={Pricing} />

      {/* 투어커뮤니케이션 파트너 랜딩페이지 */}
      <Route path={"/partner-landing"} component={PartnerLandingPage} />

      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
