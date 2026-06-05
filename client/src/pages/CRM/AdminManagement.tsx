import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function AdminManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    phone: "",
    role: "admin" as const,
  });

  // API calls
  const { data: admins, isLoading, refetch } = trpc.adminAccounts.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const createMutation = trpc.adminAccounts.create.useMutation({
    onSuccess: () => {
      toast.success("관리자 계정이 생성되었습니다.");
      setIsCreateOpen(false);
      setFormData({ username: "", password: "", name: "", email: "", phone: "", role: "admin" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "계정 생성 실패");
    },
  });

  const updateMutation = trpc.adminAccounts.update.useMutation({
    onSuccess: () => {
      toast.success("관리자 계정이 수정되었습니다.");
      setIsEditOpen(false);
      setSelectedAdmin(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "계정 수정 실패");
    },
  });

  const deleteMutation = trpc.adminAccounts.delete.useMutation({
    onSuccess: () => {
      toast.success("관리자 계정이 삭제되었습니다.");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "계정 삭제 실패");
    },
  });

  const handleCreate = () => {
    if (!formData.username || !formData.password) {
      toast.error("username과 password는 필수입니다.");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedAdmin) return;
    updateMutation.mutate({
      id: selectedAdmin.id,
      name: formData.name || selectedAdmin.name,
      email: formData.email || selectedAdmin.email,
      phone: formData.phone || selectedAdmin.phone,
      role: formData.role,
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("정말 삭제하시겠습니까?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (admin: any) => {
    setSelectedAdmin(admin);
    setFormData({
      username: admin.username,
      password: "",
      name: admin.name || "",
      email: admin.email || "",
      phone: admin.phone || "",
      role: admin.role,
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>마스터 관리자 관리</CardTitle>
              <CardDescription>
                신규 관리자 계정을 생성하고 기존 관리자의 권한을 관리합니다.
              </CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus size={16} />
                  신규 관리자 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>신규 관리자 계정 생성</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Username *</label>
                    <Input
                      placeholder="admin_username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Password *</label>
                    <div className="flex gap-2">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="최소 8자 이상"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">이름</label>
                    <Input
                      placeholder="관리자 이름"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">이메일</label>
                    <Input
                      type="email"
                      placeholder="admin@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">전화번호</label>
                    <Input
                      placeholder="010-1234-5678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">권한</label>
                    <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as any })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">관리자</SelectItem>
                        <SelectItem value="master">마스터</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? "생성 중..." : "생성"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      취소
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>권한</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>마지막 로그인</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : admins && admins.length > 0 ? (
                  admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.username}</TableCell>
                      <TableCell>{admin.name || "-"}</TableCell>
                      <TableCell>{admin.email || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-sm ${
                          admin.role === "master" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {admin.role === "master" ? "마스터" : "관리자"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-sm ${
                          admin.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {admin.isActive ? "활성" : "비활성"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(admin)}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(admin.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      관리자 계정이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>관리자 계정 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Username</label>
              <Input disabled value={formData.username} />
            </div>
            <div>
              <label className="text-sm font-medium">이름</label>
              <Input
                placeholder="관리자 이름"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">이메일</label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">전화번호</label>
              <Input
                placeholder="010-1234-5678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">권한</label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="master">마스터</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "수정 중..." : "수정"}
              </Button>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
