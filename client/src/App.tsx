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

// Other Pages
import EstimateView from "./pages/EstimateView";

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

      {/* ERP 관리자 백오피스 - ERPLayout이 내부 라우팅 처리 */}
      <Route path={"/erp"} nest component={ERPLayout} />

      {/* /admin → /erp 리다이렉트 */}
      <Route path={"/admin"} component={() => { window.location.replace("/erp"); return null; }} />
      <Route path={"/admin/:rest*"} component={() => { window.location.replace("/erp"); return null; }} />

      {/* 기타 */}
      <Route path={"/estimate/:token"} component={EstimateView} />

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
