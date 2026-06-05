import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { Plus, Trash2, Edit2, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // 관리자 목록 조회
  const { data: admins, isLoading, refetch } = trpc.adminManagement.list.useQuery();

  // 신규 관리자 생성
  const createMutation = trpc.adminManagement.create.useMutation({
    onSuccess: () => {
      toast.success('관리자 계정이 생성되었습니다');
      setShowCreateDialog(false);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || '관리자 생성 실패');
    },
  });

  // 비밀번호 변경
  const changePasswordMutation = trpc.adminManagement.changePassword.useMutation({
    onSuccess: () => {
      toast.success('비밀번호가 변경되었습니다');
      setShowPasswordDialog(false);
      setSelectedAdminId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || '비밀번호 변경 실패');
    },
  });

  // 계정 삭제
  const deleteMutation = trpc.adminManagement.delete.useMutation({
    onSuccess: () => {
      toast.success('관리자 계정이 삭제되었습니다');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || '삭제 실패');
    },
  });

  // 활성화/비활성화
  const toggleActiveMutation = trpc.adminManagement.toggleActive.useMutation({
    onSuccess: () => {
      toast.success('상태가 변경되었습니다');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || '상태 변경 실패');
    },
  });

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">마스터 관리자 관리</h1>
          <p className="text-slate-400 mt-1">관리자 계정을 생성하고 관리합니다</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-dogolf-green hover:bg-dogolf-green-dark text-white"
        >
          <Plus size={18} className="mr-2" />
          신규 관리자 추가
        </Button>
      </div>

      {/* 관리자 목록 */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">관리자 목록</CardTitle>
          <CardDescription>총 {admins?.length || 0}명</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">로딩 중...</div>
          ) : admins && admins.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">아이디</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">이름</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">이메일</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">역할</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">상태</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">마지막 로그인</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin: any) => (
                    <tr key={admin.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                      <td className="py-3 px-4 text-white font-mono">{admin.username}</td>
                      <td className="py-3 px-4 text-white">{admin.name}</td>
                      <td className="py-3 px-4 text-slate-300">{admin.email || '-'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={admin.role === 'master' ? 'default' : 'secondary'}>
                          {admin.role === 'master' ? '마스터' : '관리자'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={admin.isActive ? 'default' : 'destructive'}>
                          {admin.isActive ? '활성' : '비활성'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {admin.lastLoginAt
                          ? new Date(admin.lastLoginAt).toLocaleString('ko-KR')
                          : '없음'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAdminId(admin.id);
                              setShowPasswordDialog(true);
                            }}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Lock size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: admin.id,
                                isActive: !admin.isActive,
                              })
                            }
                            className="text-yellow-400 hover:text-yellow-300"
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate({ id: admin.id })}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">관리자가 없습니다</div>
          )}
        </CardContent>
      </Card>

      {/* 신규 관리자 생성 다이얼로그 */}
      {showCreateDialog && (
        <CreateAdminDialog
          onClose={() => setShowCreateDialog(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* 비밀번호 변경 다이얼로그 */}
      {showPasswordDialog && selectedAdminId && (
        <ChangePasswordDialog
          adminId={selectedAdminId}
          onClose={() => {
            setShowPasswordDialog(false);
            setSelectedAdminId(null);
          }}
          onSubmit={(password) =>
            changePasswordMutation.mutate({
              id: selectedAdminId,
              newPassword: password,
            })
          }
          isLoading={changePasswordMutation.isPending}
        />
      )}
    </div>
  );
}

// 신규 관리자 생성 다이얼로그
function CreateAdminDialog({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role: 'admin' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-800 border-slate-700 w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-white">신규 관리자 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">아이디</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="관리자 아이디"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">비밀번호</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="8자 이상"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">이름</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="관리자 이름"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">이메일</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="이메일 (선택)"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1"
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-dogolf-green hover:bg-dogolf-green-dark text-white"
                disabled={isLoading}
              >
                {isLoading ? '생성 중...' : '생성'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// 비밀번호 변경 다이얼로그
function ChangePasswordDialog({
  adminId,
  onClose,
  onSubmit,
  isLoading,
}: {
  adminId: number;
  onClose: () => void;
  onSubmit: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-800 border-slate-700 w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-white">비밀번호 변경</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">새 비밀번호</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  className="bg-slate-700 border-slate-600 text-white pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1"
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || password.length < 8}
              >
                {isLoading ? '변경 중...' : '변경'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
