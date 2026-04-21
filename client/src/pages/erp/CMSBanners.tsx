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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Image } from "lucide-react";

function BannerFormDialog({
  open, onClose, editBanner,
}: {
  open: boolean;
  onClose: () => void;
  editBanner?: any;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    title: editBanner?.title || "",
    imageUrl: editBanner?.imageUrl || "",
    linkUrl: editBanner?.linkUrl || "",
    sortOrder: editBanner?.sortOrder || 0,
    isActive: editBanner?.isActive ?? true,
  });

  const createMutation = trpc.cms.createBanner.useMutation({
    onSuccess: () => {
      toast.success("배너가 등록되었습니다.");
      utils.cms.listBanners.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.cms.updateBanner.useMutation({
    onSuccess: () => {
      toast.success("배너가 수정되었습니다.");
      utils.cms.listBanners.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("배너 제목을 입력해주세요.");
    if (!form.imageUrl.trim()) return toast.error("이미지 URL을 입력해주세요.");
    if (editBanner) {
      updateMutation.mutate({ id: editBanner.id, title: form.title, isActive: form.isActive, sortOrder: form.sortOrder });
    } else {
      createMutation.mutate({ title: form.title, imageUrl: form.imageUrl, linkUrl: form.linkUrl || undefined, isActive: form.isActive, sortOrder: form.sortOrder });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editBanner ? "배너 수정" : "배너 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>배너 제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 태국 특가 프로모션"
              className="mt-1"
            />
          </div>
          <div>
            <Label>이미지 URL *</Label>
            <Input
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
          {form.imageUrl && (
            <div className="rounded-lg overflow-hidden border border-slate-200 aspect-video">
              <img src={form.imageUrl} alt="배너 미리보기" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <div>
            <Label>링크 URL</Label>
            <Input
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="/packages 또는 https://..."
              className="mt-1"
            />
          </div>
          <div>
            <Label>정렬 순서</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              className="mt-1"
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            />
            <Label>활성화</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {editBanner ? "수정" : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CMSBannersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editBanner, setEditBanner] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.cms.listBanners.useQuery();

  const deleteMutation = trpc.cms.deleteBanner.useMutation({
    onSuccess: () => {
      toast.success("배너가 삭제되었습니다.");
      utils.cms.listBanners.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <ERPLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">배너 관리</h1>
            <p className="text-slate-500 text-sm mt-1">홈페이지 메인 배너를 관리합니다</p>
          </div>
          <Button
            onClick={() => { setEditBanner(null); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus size={16} className="mr-1" /> 배너 등록
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">로딩 중...</div>
            ) : !data?.length ? (
              <div className="py-20 text-center">
                <Image size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">등록된 배너가 없습니다</p>
                <Button onClick={() => setShowForm(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
                  첫 배너 등록하기
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.map((banner: any) => (
                  <div key={banner.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-24 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      {banner.imageUrl ? (
                        <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Image size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{banner.title}</p>
                      {banner.linkUrl && (
                        <p className="text-xs text-slate-400 truncate">{banner.linkUrl}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">순서 {banner.sortOrder}</span>
                      <Badge className={`text-xs ${banner.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {banner.isActive ? "활성" : "비활성"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600"
                        onClick={() => { setEditBanner(banner); setShowForm(true); }}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                        onClick={() => {
                          if (confirm(`"${banner.title}" 배너를 삭제하시겠습니까?`)) {
                            deleteMutation.mutate({ id: banner.id });
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BannerFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditBanner(null); }}
        editBanner={editBanner}
      />
    </ERPLayout>
  );
}
