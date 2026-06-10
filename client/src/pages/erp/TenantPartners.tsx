/**
 * 업체용 거래처 관리
 * - 각 업체가 예약/송금/정산을 진행하는 거래처(제휴여행사/숙소/대리점) 원장
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  travel_agency: "제휴여행사", accommodation: "숙소", agency: "대리점", other: "기타",
};

export default function TenantPartners() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [partnerType, setPartnerType] = useState<string>("all");

  const { data, isLoading } = trpc.tenantPartners.list.useQuery({
    page, pageSize: 20, search: search || undefined, partnerType: partnerType as any,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const emptyForm = {
    companyName: "", partnerType: "travel_agency", businessNumber: "",
    contactName: "", contactPhone: "", bankName: "", accountNumber: "", accountHolder: "", notes: "",
  };
  const [form, setForm] = useState({ ...emptyForm });

  const createMut = trpc.tenantPartners.create.useMutation({
    onSuccess: () => { toast.success("거래처가 추가되었습니다."); utils.tenantPartners.list.invalidate(); reset(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.tenantPartners.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다."); utils.tenantPartners.list.invalidate(); reset(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.tenantPartners.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); utils.tenantPartners.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function reset() { setForm({ ...emptyForm }); setEditId(null); setDialogOpen(false); }

  function openEdit(item: any) {
    setEditId(item.id);
    setForm({
      companyName: item.companyName, partnerType: item.partnerType, businessNumber: item.businessNumber ?? "",
      contactName: item.contactName ?? "", contactPhone: item.contactPhone ?? "",
      bankName: item.bankName ?? "", accountNumber: item.accountNumber ?? "", accountHolder: item.accountHolder ?? "", notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.companyName.trim()) { toast.error("거래처명을 입력하세요."); return; }
    if (editId) updateMut.mutate({ id: editId, ...form, partnerType: form.partnerType as any });
    else createMut.mutate({ ...form, partnerType: form.partnerType as any });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">거래처 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">예약·송금·정산을 진행하는 거래처(제휴여행사/숙소/대리점)를 관리합니다.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) reset(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { reset(); setDialogOpen(true); }}><Plus size={16} className="mr-1" /> 거래처 추가</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "거래처 수정" : "거래처 추가"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">거래처명 *</label>
                  <Input className="mt-1" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">유형</label>
                  <Select value={form.partnerType} onValueChange={(v) => setForm({ ...form, partnerType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">사업자번호</label>
                  <Input className="mt-1" value={form.businessNumber} onChange={(e) => setForm({ ...form, businessNumber: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">담당자</label>
                  <Input className="mt-1" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">담당자 전화</label>
                  <Input className="mt-1" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">은행명</label>
                  <Input className="mt-1" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">계좌번호</label>
                  <Input className="mt-1" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">예금주</label>
                  <Input className="mt-1" value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">비고</label>
                <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>취소</Button>
              <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>{editId ? "수정" : "추가"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Input placeholder="거래처명/담당자 검색..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select value={partnerType} onValueChange={(v) => { setPartnerType(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">거래처명</th>
              <th className="px-3 py-2">유형</th>
              <th className="px-3 py-2">사업자번호</th>
              <th className="px-3 py-2">담당자</th>
              <th className="px-3 py-2">계좌</th>
              <th className="px-3 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">불러오는 중...</td></tr>}
            {!isLoading && (data?.items.length ?? 0) === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">등록된 거래처가 없습니다.</td></tr>}
            {data?.items.map((item: any) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 font-medium">{item.companyName}</td>
                <td className="px-3 py-2">{TYPE_LABELS[item.partnerType] ?? item.partnerType}</td>
                <td className="px-3 py-2">{item.businessNumber ?? "-"}</td>
                <td className="px-3 py-2">{item.contactName ?? "-"}{item.contactPhone ? ` (${item.contactPhone})` : ""}</td>
                <td className="px-3 py-2">{item.bankName ? `${item.bankName} ${item.accountNumber ?? ""}` : "-"}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMut.mutate({ id: item.id }); }}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {(data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>이전</Button>
          <span className="text-sm">{page} / {Math.ceil((data?.total ?? 0) / 20)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil((data?.total ?? 0) / 20)} onClick={() => setPage((p) => p + 1)}>다음</Button>
        </div>
      )}
    </div>
  );
}
