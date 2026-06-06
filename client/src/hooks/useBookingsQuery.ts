/**
 * useBookingsQuery
 * 예약 목록 조회 커스텀 훅
 * - 필터/페이지네이션/정렬 상태를 한 곳에서 관리
 * - trpc.reservations.list.useQuery와 안전하게 연동
 * - 무한 re-fetch 방지: 입력 객체를 useMemo로 안정화
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "all";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "all";
export type SortBy = "departureDate" | "createdAt" | "headcount";
export type SortOrder = "asc" | "desc";

export interface BookingsFilter {
  search?: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  warningOnly?: boolean;
}

export interface BookingsPagination {
  page: number;
  pageSize: number;
}

/**
 * 예약 목록 조회 훅
 * @param initialFilter 초기 필터 상태
 * @param initialPagination 초기 페이지네이션 상태
 */
export function useBookingsQuery(
  initialFilter: BookingsFilter = {},
  initialPagination: BookingsPagination = { page: 1, pageSize: 20 }
) {
  const [filter, setFilter] = useState<BookingsFilter>(initialFilter);
  const [pagination, setPagination] = useState<BookingsPagination>(initialPagination);

  // 쿼리 입력 안정화 (useMemo로 불필요한 re-fetch 방지)
  const queryInput = useMemo(
    () => ({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filter.search,
      status: filter.status ?? "all",
      paymentStatus: filter.paymentStatus ?? "all",
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      sortBy: filter.sortBy ?? "departureDate",
      sortOrder: filter.sortOrder ?? "desc",
      warningOnly: filter.warningOnly ?? false,
    }),
    [filter, pagination]
  );

  const query = trpc.reservations.list.useQuery(queryInput, {
    // 필터 변경 시 1페이지로 자동 리셋 (staleTime 0으로 즉시 갱신)
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  /**
   * 필터 업데이트 (페이지는 자동으로 1로 리셋)
   */
  const updateFilter = (partial: Partial<BookingsFilter>) => {
    setFilter((prev) => ({ ...prev, ...partial }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  /**
   * 필터 초기화
   */
  const resetFilter = () => {
    setFilter(initialFilter);
    setPagination(initialPagination);
  };

  /**
   * 페이지 변경
   */
  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  /**
   * 페이지 크기 변경 (1페이지로 리셋)
   */
  const setPageSize = (pageSize: number) => {
    setPagination({ page: 1, pageSize });
  };

  return {
    // 쿼리 상태
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,

    // 필터/페이지네이션 상태
    filter,
    pagination,

    // 액션
    updateFilter,
    resetFilter,
    setPage,
    setPageSize,
  };
}
