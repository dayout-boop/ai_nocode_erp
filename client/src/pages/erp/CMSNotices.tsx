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
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Megaphone } from "lucide-react";

const CATEGORY_MAP: Record<string, string> = {
  notice: "공지",
  event: "이벤트",
  news: "뉴스",
  promotion: "프로모션",
};

function NoticeFormDialog({
  open, onClose, editNotice,
}: {
  open: boolean;
  onClose: () => void;
  editNotice?: any;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    title: editNotice?.title || "",
    content: editNotice?.content || "",
    category: editNotice?.category || "notice",
    isPublished: editNotice?.isPublished ?? true,
    isImportant: editNotice?.isImportant ?? false,
  });

  const createMutation = trpc.cms.createNotice.useMutation({
    onSuccess: () => {
      toast.success("공지사항이 등록되었습니다.");
      utils.cms.listNotices.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.cms.updateNotice.useMutation({
    onSuccess: () => {
      toast.success("공지사항이 수정되었습니다.");
      utils.cms.listNotices.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("제목을 입력해주세요.");
    if (editNotice) {
      updateMutation.mutate({ id: editNotice.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editNotice ? "공지사항 수정" : "공지사항 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="공지사항 제목을 입력하세요"
              className="mt-1"
            />
          </div>
          <div>
            <Label>카테고리</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>내용</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="공지사항 내용을 입력하세요"
              rows={6}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
              />
              <Label>게시 여부</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
              checked={form.isImportant}
              onCheckedChange={(v) => setForm({ ...form, isImportant: v })}
              />
              <Label>상단 고정</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {editNotice ? "수정" : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CMSNoticesPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editNotice, setEditNotice] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.cms.listNotices.useQuery({ page, limit: 15 });

  const deleteMutation = trpc.cms.deleteNotice.useMutation({
    onSuccess: () => {
      toast.success("공지사항이 삭제되었습니다.");
      utils.cms.listNotices.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <ERPLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">공지사항 관리</h1>
            <p className="text-slate-500 text-sm mt-1">홈페이지 공지사항을 관리합니다</p>
          </div>
          <Button
            onClick={() => { setEditNotice(null); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus size={16} className="mr-1" /> 공지 등록
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">로딩 중...</div>
            ) : !data?.items?.length ? (
              <div className="py-20 text-center">
                <Megaphone size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">공지사항이 없습니다</p>
                <Button onClick={() => setShowForm(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
                  첫 공지 등록하기
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">제목</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">카테고리</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">상태</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">고정</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">등록일</th>
                      <th className="text-right px-5 py-3 text-slate-500 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map((notice: any) => (
                      <tr key={notice.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">{notice.title}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className="text-xs bg-slate-100 text-slate-600">
                            {CATEGORY_MAP[notice.category] || notice.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${notice.isPublished ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                            {notice.isPublished ? "게시중" : "비공개"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {notice.isImportant && (
                            <Badge className="text-xs bg-amber-100 text-amber-700">고정</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(notice.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600"
                              onClick={() => { setEditNotice(notice); setShowForm(true); }}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              onClick={() => {
                                if (confirm(`"${notice.title}" 공지를 삭제하시겠습니까?`)) {
                                  deleteMutation.mutate({ id: notice.id });
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
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
            <p className="text-sm text-slate-500">총 {data.total}건</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
              <span className="text-sm text-slate-600 px-3 py-1.5">{page} / {Math.ceil(data.total / 15)}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 15)}>다음</Button>
            </div>
          </div>
        )}
      </div>

      <NoticeFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditNotice(null); }}
        editNotice={editNotice}
      />
    </ERPLayout>
  );
}
