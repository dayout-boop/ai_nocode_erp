/**
 * partnerTrpc.ts
 * 파트너 스태프 전용 tRPC 클라이언트
 * - Authorization: Bearer <partner_staff_token> 헤더 자동 주입
 * - ERPPartnerLayout 내부에서만 사용
 */

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";

export const partnerTrpc = createTRPCReact<AppRouter>();

export function createPartnerTrpcClient() {
  return partnerTrpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch(input, init) {
          const token = localStorage.getItem("partner_staff_token");
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
            headers: {
              ...(init?.headers ?? {}),
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
        },
      }),
    ],
  });
}

export function createPartnerQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000 },
    },
  });
}
