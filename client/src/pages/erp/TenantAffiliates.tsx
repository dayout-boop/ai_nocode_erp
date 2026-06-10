/**
 * 업체용 제휴사 관리 (2계층)
 * - 마스터 제휴사(통합코드)를 검색해 재사용하거나, 없으면 자체 신규 등록
 * - 자사 호칭/요금/잔액을 별도 보관
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Link2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  golf_domestic: "국내골프", golf_overseas: "해외골프", hotel: "숙소",
  attraction: "관광지", transport: "교통", other: "기타",
};

export default function TenantAffiliates() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const { data, isLoading } = trpc.tenantAffiliates.list.useQuery({
    page, pageSize: 20, search: search || undefined, category: category as any,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    masterAffiliateId: null as number | null,
    customName: "", category: "golf_domestic",
    customGreenFee: 0, prepaidBalance: 0, depositBalance: 0,
    contactName: "", contactPhone: "", notes: "",
  });

  // 마스터 제휴사 검색
  const [masterSearch, setMasterSearch] = useState("");
  const { data: masterResults } = trpc.tenantAffiliates.searchMaster.useQuery(
    { search: masterSearch || undefined, limit: 10 },
    { enabled: dialogOpen && masterSearch.length > 0 }
  );

  const createMut = trpc.tenantAffiliates.create.useMutation({
    onSuccess: () => { toast.success("제휴사가 추가되었습니다."); utils.tenantAffiliates.list.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.tenantAffiliates.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다."); utils.tenantAffiliates.list.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.tenantAffiliates.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); utils.tenantAffiliates.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ masterAffiliateId: null, customName: "", category: "golf_domestic", customGreenFee: 0, prepaidBalance: 0, depositBalance: 0, contactName: "", contactPhone: "", notes: "" });
    setMasterSearch(""); setEditId(null); setDialogOpen(false);
  }

  function openEdit(item: any) {
    setEditId(item.id);
    setForm({
      masterAffiliateId: item.masterAffiliateId,
      customName: item.customName, category: item.category,
      customGreenFee: item.customGreenFee ?? 0, prepaidBalance: item.prepaidBalance ?? 0, depositBalance: item.depositBalance ?? 0,
      contactName: item.contactName ?? "", contactPhone: item.contactPhone ?? "", notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.customName.trim()) { toast.error("자사 호칭명을 입력하세요."); return; }
    if (editId) {
      updateMut.mutate({ id: editId, customName: form.customName, category: form.category as any, customGreenFee: form.customGreenFee, prepaidBalance: form.prepaidBalance, depositBalance: form.depositBalance, contactName: form.contactName, contactPhone: form.contactPhone, notes: form.notes });
    } else {
      createMut.mutate({ ...form, category: form.category as any });
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">우리 제휴사</h1>
          <p className="text-sm text-muted-foreground mt-1">마스터 통합코드를 검색해 재사용하거나, 자사 제휴사를 직접 등록합니다.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus size={16} className="mr-1" /> 제휴사 추가</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "제휴사 수정" : "제휴사 추가"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {!editId && (
                <div className="rounded-md border p-3 bg-muted/30">
                  <label className="text-xs font-medium flex items-center gap-1"><Search size={12} /> 마스터 제휴사 검색 (재사용)</label>
                  <Input className="mt-1" placeholder="골프장/숙소명 검색..." value={masterSearch} onChange={(e) => setMasterSearch(e.target.value)} />
                  {masterResults && masterResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {masterResults.map((m) => (
                        <button key={m.id} type="button"
                          className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent ${form.masterAffiliateId === m.id ? "bg-accent" : ""}`}
                          onClick={() => setForm((f) => ({ ...f, masterAffiliateId: m.id, customName: f.customName || m.name, category: (m.type as string) ?? "golf_domestic" }))}>
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{m.region ?? ""} {m.country ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {form.masterAffiliateId && (
                    <Badge variant="secondary" className="mt-2"><Link2 size={10} className="mr-1" /> 마스터 #{form.masterAffiliateId} 연결됨</Badge>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-medium">자사 호칭명 *</label>
                <Input className="mt-1" value={form.customName} onChange={(e) => setForm({ ...form, customName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">분류</label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">자사 그린피/공급가</label>
                  <Input className="mt-1" type="number" value={form.customGreenFee} onChange={(e) => setForm({ ...form, customGreenFee: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">선입금 잔액</label>
                  <Input className="mt-1" type="number" value={form.prepaidBalance} onChange={(e) => setForm({ ...form, prepaidBalance: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">데파짓 잔액</label>
                  <Input className="mt-1" type="number" value={form.depositBalance} onChange={(e) => setForm({ ...form, depositBalance: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">담당자</label>
                  <Input className="mt-1" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">담당자 전화</label>
                  <Input className="mt-1" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">비고</label>
                <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>취소</Button>
              <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>{editId ? "수정" : "추가"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Input placeholder="자사 호칭명 검색..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 분류</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">자사 호칭</th>
              <th className="px-3 py-2">분류</th>
              <th className="px-3 py-2">마스터 연결</th>
              <th className="px-3 py-2 text-right">자사 요금</th>
              <th className="px-3 py-2 text-right">선입금</th>
              <th className="px-3 py-2 text-right">데파짓</th>
              <th className="px-3 py-2">담당자</th>
              <th className="px-3 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">불러오는 중...</td></tr>}
            {!isLoading && (data?.items.length ?? 0) === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">등록된 제휴사가 없습니다. 마스터 제휴사를 검색해 추가해보세요.</td></tr>}
            {data?.items.map((item: any) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 font-medium">{item.customName}</td>
                <td className="px-3 py-2">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                <td className="px-3 py-2">{item.masterAffiliateId ? <Badge variant="secondary" className="text-xs"><Link2 size={10} className="mr-1" />#{item.masterAffiliateId}</Badge> : <span className="text-xs text-muted-foreground">자체등록</span>}</td>
                <td className="px-3 py-2 text-right">{(item.customGreenFee ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{(item.prepaidBalance ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{(item.depositBalance ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2">{item.contactName ?? "-"}</td>
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
