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
import Inquiry from "./pages/Inquiry";

// ERP Admin Pages
import ERPDashboard from "./pages/erp/Dashboard";
import ERPPackages from "./pages/erp/Packages";
import ERPPackageDetail from "./pages/erp/PackageDetail";
import ERPBookings from "./pages/erp/Bookings";
import ERPInquiries from "./pages/erp/Inquiries";
import ERPSettlements from "./pages/erp/Settlements";
import ERPCRMCustomers from "./pages/erp/CRMCustomers";
import ERPCMSNotices from "./pages/erp/CMSNotices";
import ERPCMSBanners from "./pages/erp/CMSBanners";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* 프론트 사이트 */}
      <Route path={"/"} component={Home} />
      <Route path={"/packages"} component={Packages} />
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
      <Route path={"/erp/cms/notices"} component={ERPCMSNotices} />
      <Route path={"/erp/cms/banners"} component={ERPCMSBanners} />

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
