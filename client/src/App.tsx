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

// ERP Admin Pages
import ERPDashboard from "./pages/erp/Dashboard";
import ERPPackages from "./pages/erp/Packages";
import ERPPackageDetail from "./pages/erp/PackageDetail";
import ERPBookings from "./pages/erp/Bookings";
import ERPInquiries from "./pages/erp/Inquiries";
import ERPSettlements from "./pages/erp/Settlements";
import ERPCRMCustomers from "./pages/erp/CRMCustomers";
import ERPCRMPartners from "./pages/erp/CRMPartners";
import ERPCMSNotices from "./pages/erp/CMSNotices";
import ERPCMSBanners from "./pages/erp/CMSBanners";
import GeminiAssistant from "./pages/erp/GeminiAssistant";
import AILogs from "./pages/erp/AILogs";
import DevAI from "./pages/erp/DevAI";
import DevAIOrchestrator from "./pages/erp/DevAIOrchestrator";
import AIDevEngine from "./pages/erp/AIDevEngine";
import MasterAI from "./pages/erp/MasterAI";
import AIEngine from "./pages/erp/AIEngine";
import ReservationManagement from "./pages/erp/ReservationManagement";
import InquiryTemplates from "./pages/erp/InquiryTemplates";
import FinanceManagement from "./pages/erp/FinanceManagement";
import AffiliateManagement from "./pages/erp/AffiliateManagement";
import GolfTalkAdmin from "./pages/erp/GolfTalkAdmin";
import ManagerAdmin from "./pages/erp/ManagerAdmin";
import MasterLogs from "./pages/erp/MasterLogs";
import MasterCosts from "./pages/erp/MasterCosts";
import ERPSettings from "./pages/erp/ERPSettings";
import OpenRouterAgent from "./pages/erp/OpenRouterAgent";
import CustomerEstimateTemplates from "./pages/erp/CustomerEstimateTemplates";
import EstimateView from "./pages/EstimateView";
import DevDashboard from "./pages/erp/DevDashboard";

// Partner Pages
import PartnerDashboard from "./pages/Partner/PartnerDashboard";
import PartnerChat from "./pages/Partner/PartnerChat";

function Router() {
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

      {/* ERP 관리자 백오피스 */}
      <Route path={"/erp"} component={ERPDashboard} />
      <Route path={"/erp/dashboard"} component={ERPDashboard} />
      <Route path={"/erp/packages"} component={ERPPackages} />
      <Route path={"/erp/packages/:id"} component={ERPPackageDetail} />
      <Route path={"/erp/bookings"} component={ERPBookings} />
      <Route path={"/erp/inquiries"} component={ERPInquiries} />
      <Route path={"/erp/settlements"} component={ERPSettlements} />
      <Route path={"/erp/crm"} component={ERPCRMCustomers} />
      <Route path={"/erp/crm/partners"} component={ERPCRMPartners} />
      <Route path={"/erp/crm/affiliates"} component={AffiliateManagement} />
      <Route path={"/erp/reservations"} component={ReservationManagement} />
      <Route path={"/erp/reservations/templates"} component={InquiryTemplates} />
      <Route path={"/erp/finance"} component={FinanceManagement} />
      <Route path={"/erp/cms"} component={() => { window.location.replace('/erp/cms/notices'); return null; }} />
      <Route path={"/erp/cms/notices"} component={ERPCMSNotices} />
      <Route path={"/erp/cms/banners"} component={ERPCMSBanners} />
      <Route path={"/erp/gemini"} component={GeminiAssistant} />
      <Route path={"/erp/ai-logs"} component={AILogs} />
      <Route path={"/erp/dev-ai"} component={DevAI} />
      <Route path={"/erp/orchestrator"} component={DevAIOrchestrator} />
      <Route path={"/erp/ai-dev-engine"} component={AIDevEngine} />
      <Route path={"/erp/master-ai"} component={MasterAI} />
      <Route path={"/erp/master-ai/logs"} component={MasterLogs} />
      <Route path={"/erp/master-ai/costs"} component={MasterCosts} />
      <Route path={"/erp/ai-engine"} component={AIEngine} />
      <Route path={"/erp/golftalk-admin"} component={GolfTalkAdmin} />
      <Route path={"/erp/manager-admin"} component={ManagerAdmin} />
      <Route path={"/erp/settings"} component={ERPSettings} />
      <Route path={"/erp/openrouter-agent"} component={OpenRouterAgent} />
      <Route path={"/erp/reservations/estimate-templates"} component={CustomerEstimateTemplates} />
      <Route path={"/estimate/:token"} component={EstimateView} />
      <Route path={"/erp/dev-dashboard"} component={DevDashboard} />

      {/* /admin → /erp 리다이렉트 */}
      <Route path={"/admin"} component={() => { window.location.replace("/erp"); return null; }} />
      <Route path={"/admin/:rest*"} component={() => { window.location.replace("/erp"); return null; }} />

      {/* 파트너 센터 */}
      <Route path={"/partner"} component={PartnerDashboard} />
      <Route path={"/partner/chat"} component={PartnerChat} />

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
