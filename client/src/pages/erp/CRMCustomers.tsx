import { useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Users, MessageSquare, Plus } from "lucide-react";

function CustomerDetailDialog({ customer, onClose }: { customer: any; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [newMemo, setNewMemo] = useState("");

  const { data: memos } = trpc.crm.getMemos.useQuery({ userId: customer.id });

  const addMemoMutation = trpc.crm.addMemo.useMutation({
    onSuccess: () => {
      toast.success("메모가 추가되었습니다.");
      utils.crm.getMemos.invalidate({ userId: customer.id });
      setNewMemo("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>고객 상세 - {customer.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-slate-500">이름</p>
              <p className="font-medium text-slate-800">{customer.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">이메일</p>
              <p className="font-medium text-slate-800">{customer.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">가입일</p>
              <p className="font-medium text-slate-800">
                {new Date(customer.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">권한</p>
              <Badge className={`text-xs ${customer.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                {customer.role === "admin" ? "관리자" : "일반회원"}
              </Badge>
            </div>
          </div>

          {/* 상담 메모 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium text-slate-700 text-sm">상담 메모</p>
              <span className="text-xs text-slate-400">{memos?.length || 0}개</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {memos?.length ? memos.map((memo: any) => (
                <div key={memo.id} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{memo.content}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(memo.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              )) : (
                <p className="text-sm text-slate-400 text-center py-4">메모가 없습니다</p>
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="상담 내용을 입력하세요..."
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={() => addMemoMutation.mutate({ userId: customer.id, content: newMemo })}
                disabled={!newMemo.trim() || addMemoMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white self-end"
                size="sm"
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CRMCustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const { data, isLoading } = trpc.crm.searchCustomers.useQuery({
    page,
    limit: 15,
    search: search || undefined,
  });

  return (
    <ERPLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">고객관리 (CRM)</h1>
          <p className="text-slate-500 text-sm mt-1">회원 정보 조회 및 상담 메모를 관리합니다</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="이름 또는 이메일 검색..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">로딩 중...</div>
            ) : !data?.items?.length ? (
              <div className="py-20 text-center">
                <Users size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">회원이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">이름</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">이메일</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">권한</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">가입일</th>
                      <th className="text-right px-5 py-3 text-slate-500 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map((customer: any) => (
                      <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">{customer.name || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{customer.email || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${customer.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                            {customer.role === "admin" ? "관리자" : "회원"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(customer.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800"
                            onClick={() => setSelectedCustomer(customer)}
                          >
                            <MessageSquare size={13} className="mr-1" /> 상담
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {data && data.total > 15 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">총 {data.total}명</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
              <span className="text-sm text-slate-600 px-3 py-1.5">{page} / {Math.ceil(data.total / 15)}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 15)}>다음</Button>
            </div>
          </div>
        )}
      </div>

      {selectedCustomer && (
        <CustomerDetailDialog customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </ERPLayout>
  );
}
