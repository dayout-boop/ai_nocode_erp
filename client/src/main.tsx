import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // /erp 경로에서는 마스터 로그인 페이지로 리다이렉트 (Manus OAuth 아님)
  const currentPath = window.location.pathname;
  if (currentPath.startsWith('/erp')) {
    // 마스터 세션이 없으면 마스터 로그인 페이지로
    const adminLoginTime = localStorage.getItem('adminLoginTime');
    if (!adminLoginTime) {
      window.location.href = window.location.origin + '/erp/login';
      return;
    }
    // 마스터 세션이 있는데 UNAUTHORIZED면 세션 만료 - 재로그인
    localStorage.removeItem('adminLoginTime');
    localStorage.removeItem('adminUsername');
    window.location.href = window.location.origin + '/erp/login';
    return;
  }

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// 마스터 테넌트 셀렉터 값(localStorage)을 읽어 요청 헤더로 전송.
// - 'all' 또는 미설정 → 헤더 생략(서버에서 전체보기 기본)
// - 숫자 문자열 → 해당 테넌트만
// 파트너 세션에서는 서버가 이 헤더를 무시하므로 안전.
const ACTIVE_TENANT_STORAGE_KEY = "erp_active_tenant";

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        if (typeof window === "undefined") return {};
        try {
          const v = window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
          if (v && v !== "all") {
            return { "x-active-tenant": v };
          }
        } catch {
          // localStorage 접근 실패 시 헤더 생략
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
