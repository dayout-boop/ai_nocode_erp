/**
 * 관리자 계정 관리 페이지
 * - master 역할: 계정 생성/삭제/활성화 가능
 * - admin 역할: 목록 조회 및 자기 비밀번호 변경만 가능
 * - admin 계정(username='admin')은 삭제/비활성화 불가
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { Plus, Trash2, Lock, Eye, EyeOff, Shield, ShieldAlert, UserCheck, UserX, Info, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

  // 내 계정 정보 조회 (현재 로그인한 세션)
  const { data: myInfo } = trpc.adminManagement.getMyInfo.useQuery();
  const isMaster = myInfo?.role === 'master';

  // 관리자 목록 조회
  const { data: admins, isLoading, refetch } = trpc.adminManagement.list.useQuery();

  // 신규 관리자 생성 (master 전용)
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

  // 계정 삭제 (master 전용)
  const deleteMutation = trpc.adminManagement.delete.useMutation({
    onSuccess: () => {
      toast.success('관리자 계정이 삭제되었습니다');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || '삭제 실패');
    },
  });

  // 계정 정보 수정 (master 전용)
  const updateMutation = trpc.adminManagement.update.useMutation({
    onSuccess: () => {
      toast.success('계정 정보가 수정되었습니다');
      setShowEditDialog(false);
      setSelectedAdmin(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || '수정 실패');
    },
  });

  // 활성화/비활성화 (master 전용)
  const toggleActiveMutation = trpc.adminManagement.toggleActive.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || '상태 변경 실패');
    },
  });

  const handleDelete = (admin: any) => {
    if (admin.username === 'admin') {
      toast.error('admin 계정은 삭제할 수 없습니다');
      return;
    }
    if (admin.id === myInfo?.id) {
      toast.error('자신의 계정은 삭제할 수 없습니다');
      return;
    }
    if (confirm(`"${admin.name}(${admin.username})" 계정을 삭제하시겠습니까?`)) {
      deleteMutation.mutate({ id: admin.id });
    }
  };

  const handleToggleActive = (admin: any) => {
    if (admin.username === 'admin' && admin.isActive) {
      toast.error('admin 계정은 비활성화할 수 없습니다');
      return;
    }
    if (admin.id === myInfo?.id && admin.isActive) {
      toast.error('자신의 계정은 비활성화할 수 없습니다');
      return;
    }
    const action = admin.isActive ? '비활성화' : '활성화';
    if (confirm(`"${admin.name}(${admin.username})" 계정을 ${action}하시겠습니까?`)) {
      toggleActiveMutation.mutate({ id: admin.id, isActive: !admin.isActive });
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">관리자 계정 관리</h1>
          <p className="text-slate-400 mt-1">
            {isMaster
              ? '마스터 권한으로 모든 계정을 관리할 수 있습니다'
              : '관리자 계정 목록을 조회하고 내 비밀번호를 변경할 수 있습니다'}
          </p>
        </div>
        {isMaster && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-dogolf-green hover:bg-dogolf-green-dark text-white"
          >
            <Plus size={18} className="mr-2" />
            신규 계정 추가
          </Button>
        )}
      </div>

      {/* 현재 로그인 정보 */}
      {myInfo && (
        <Card className="bg-slate-800/50 border-slate-600">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isMaster ? 'bg-amber-500/20' : 'bg-indigo-500/20'
              }`}>
                {isMaster ? (
                  <ShieldAlert size={20} className="text-amber-400" />
                ) : (
                  <Shield size={20} className="text-indigo-400" />
                )}
              </div>
              <div>
                <p className="text-white font-medium">
                  {myInfo.name} ({myInfo.username})
                  <Badge className={`ml-2 text-xs ${isMaster ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'}`}>
                    {isMaster ? '마스터' : '관리자'}
                  </Badge>
                </p>
                <p className="text-slate-400 text-sm">현재 로그인된 계정</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedAdminId(myInfo.id);
                  setShowPasswordDialog(true);
                }}
                className="ml-auto text-blue-400 hover:text-blue-300 gap-1.5"
              >
                <Lock size={14} />
                내 비밀번호 변경
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 권한 안내 (admin 역할인 경우) */}
      {!isMaster && (
        <Card className="bg-slate-800/30 border-slate-700 border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-slate-400 text-sm">
                계정 생성, 삭제, 활성화/비활성화는 <strong className="text-amber-400">마스터 관리자</strong>만 가능합니다.
                비밀번호 변경은 자신의 계정에 한해 가능합니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
                  {admins.map((admin: any) => {
                    const isMe = admin.id === myInfo?.id;
                    const isProtectedAdmin = admin.username === 'admin';
                    return (
                      <tr
                        key={admin.id}
                        className={`border-b border-slate-700 hover:bg-slate-700/50 ${isMe ? 'bg-indigo-900/10' : ''}`}
                      >
                        <td className="py-3 px-4 text-white font-mono">
                          {admin.username}
                          {isMe && (
                            <Badge className="ml-2 text-xs bg-indigo-500/20 text-indigo-300 border-indigo-500/30">나</Badge>
                          )}
                          {isProtectedAdmin && (
                            <Badge className="ml-2 text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">보호됨</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-white">{admin.name}</td>
                        <td className="py-3 px-4 text-slate-300">{admin.email || '-'}</td>
                        <td className="py-3 px-4">
                          <Badge
                            className={admin.role === 'master'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-600 text-slate-300 border-slate-500'}
                          >
                            {admin.role === 'master' ? '마스터' : '관리자'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={admin.isActive
                              ? 'bg-green-500/20 text-green-300 border-green-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'}
                          >
                            {admin.isActive ? '활성' : '비활성'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-xs">
                          {admin.lastLoginAt
                            ? new Date(admin.lastLoginAt).toLocaleString('ko-KR')
                            : '없음'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {/* 계정 정보 수정: master 전용 */}
                            {isMaster && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedAdmin(admin);
                                  setShowEditDialog(true);
                                }}
                                className="text-emerald-400 hover:text-emerald-300 h-7 w-7 p-0"
                                title="계정 정보 수정 (이름/이메일)"
                              >
                                <Pencil size={14} />
                              </Button>
                            )}

                            {/* 비밀번호 변경: master는 모두, 일반은 자기만 */}
                            {(isMaster || isMe) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedAdminId(admin.id);
                                  setShowPasswordDialog(true);
                                }}
                                className="text-blue-400 hover:text-blue-300 h-7 w-7 p-0"
                                title="비밀번호 변경"
                              >
                                <Lock size={14} />
                              </Button>
                            )}

                            {/* 활성화/비활성화: master 전용 */}
                            {isMaster && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleToggleActive(admin)}
                                disabled={toggleActiveMutation.isPending || isProtectedAdmin}
                                className={`h-7 w-7 p-0 ${
                                  admin.isActive
                                    ? 'text-yellow-400 hover:text-yellow-300'
                                    : 'text-green-400 hover:text-green-300'
                                } ${isProtectedAdmin ? 'opacity-30 cursor-not-allowed' : ''}`}
                                title={admin.isActive ? '비활성화' : '활성화'}
                              >
                                {admin.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                              </Button>
                            )}

                            {/* 삭제: master 전용, admin 계정 및 자기 자신 제외 */}
                            {isMaster && !isProtectedAdmin && !isMe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(admin)}
                                disabled={deleteMutation.isPending}
                                className="text-red-400 hover:text-red-300 h-7 w-7 p-0"
                                title="계정 삭제"
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">관리자가 없습니다</div>
          )}
        </CardContent>
      </Card>

      {/* 신규 관리자 생성 다이얼로그 (master 전용) */}
      {showCreateDialog && isMaster && (
        <CreateAdminDialog
          onClose={() => setShowCreateDialog(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* 계정 정보 수정 다이얼로그 */}
      {showEditDialog && selectedAdmin && (
        <EditAdminDialog
          admin={selectedAdmin}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedAdmin(null);
          }}
          onSubmit={(data) => updateMutation.mutate({ id: selectedAdmin.id, ...data })}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* 비밀번호 변경 다이얼로그 */}
      {showPasswordDialog && selectedAdminId && (
        <ChangePasswordDialog
          adminId={selectedAdminId}
          isMaster={isMaster}
          isOwnAccount={selectedAdminId === myInfo?.id}
          onClose={() => {
            setShowPasswordDialog(false);
            setSelectedAdminId(null);
          }}
          onSubmit={(data) =>
            changePasswordMutation.mutate({
              id: selectedAdminId,
              ...data,
            })
          }
          isLoading={changePasswordMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── 신규 관리자 생성 다이얼로그 ─────────────────────────────────────────────
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
    role: 'admin' as 'admin' | 'master',
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.name) {
      toast.error('아이디, 비밀번호, 이름은 필수 입력 항목입니다');
      return;
    }
    if (formData.password.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <Card className="bg-slate-800 border-slate-700 w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Plus size={18} className="text-dogolf-green" />
            신규 관리자 계정 추가
          </CardTitle>
          <CardDescription>마스터 권한으로 새 관리자 계정을 생성합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">아이디 <span className="text-red-400">*</span></label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="3자 이상의 아이디"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">비밀번호 <span className="text-red-400">*</span></label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="8자 이상"
                  className="bg-slate-700 border-slate-600 text-white pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">이름 <span className="text-red-400">*</span></label>
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

            <div>
              <label className="text-sm text-slate-300 mb-1 block">역할</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={formData.role === 'admin'}
                    onChange={() => setFormData({ ...formData, role: 'admin' })}
                    className="text-indigo-500"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-slate-300">관리자 (admin)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="master"
                    checked={formData.role === 'master'}
                    onChange={() => setFormData({ ...formData, role: 'master' })}
                    className="text-amber-500"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-amber-300">마스터 (master)</span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                마스터는 계정 생성/삭제/API 키 관리 권한을 가집니다
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300"
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-dogolf-green hover:bg-dogolf-green-dark text-white"
                disabled={isLoading}
              >
                {isLoading ? '생성 중...' : '계정 생성'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 비밀번호 변경 다이얼로그 ─────────────────────────────────────────────────
function ChangePasswordDialog({
  adminId,
  isMaster,
  isOwnAccount,
  onClose,
  onSubmit,
  isLoading,
}: {
  adminId: number;
  isMaster: boolean;
  isOwnAccount: boolean;
  onClose: () => void;
  onSubmit: (data: { newPassword: string; currentPassword?: string }) => void;
  isLoading: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);

  // 자기 계정이고 master가 아닌 경우 현재 비밀번호 필요
  const needCurrentPassword = isOwnAccount && !isMaster;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('새 비밀번호는 8자 이상이어야 합니다');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('새 비밀번호가 일치하지 않습니다');
      return;
    }
    if (needCurrentPassword && !currentPassword) {
      toast.error('현재 비밀번호를 입력하세요');
      return;
    }
    onSubmit({
      newPassword,
      ...(needCurrentPassword ? { currentPassword } : {}),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <Card className="bg-slate-800 border-slate-700 w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock size={18} className="text-blue-400" />
            비밀번호 변경
          </CardTitle>
          <CardDescription>
            {isOwnAccount ? '내 계정의 비밀번호를 변경합니다' : '선택한 계정의 비밀번호를 변경합니다'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 현재 비밀번호 (자기 계정이고 master가 아닌 경우) */}
            {needCurrentPassword && (
              <div>
                <label className="text-sm text-slate-300 mb-1 block">현재 비밀번호 <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="현재 비밀번호"
                    className="bg-slate-700 border-slate-600 text-white pr-10"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm text-slate-300 mb-1 block">새 비밀번호 <span className="text-red-400">*</span></label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8자 이상"
                  className="bg-slate-700 border-slate-600 text-white pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">새 비밀번호 확인 <span className="text-red-400">*</span></label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 재입력"
                className={`bg-slate-700 border-slate-600 text-white ${
                  confirmPassword && newPassword !== confirmPassword ? 'border-red-500' : ''
                }`}
                disabled={isLoading}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">비밀번호가 일치하지 않습니다</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300"
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || (!!confirmPassword && newPassword !== confirmPassword)}
              >
                {isLoading ? '변경 중...' : '비밀번호 변경'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 계정 정보 수정 다이얼로그 ───────────────────────────────────────────────
function EditAdminDialog({
  admin,
  onClose,
  onSubmit,
  isLoading,
}: {
  admin: any;
  onClose: () => void;
  onSubmit: (data: { name?: string; email?: string; phone?: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: admin.name || '',
    email: admin.email || '',
    phone: admin.phone || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('이름은 필수 입력 항목입니다');
      return;
    }
    onSubmit({
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <Card className="bg-slate-800 border-slate-700 w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Pencil size={18} className="text-emerald-400" />
            계정 정보 수정
          </CardTitle>
          <CardDescription>
            <span className="font-mono text-slate-300">{admin.username}</span> 계정의 이름과 이메일을 수정합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">이름 <span className="text-red-400">*</span></label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="관리자 이름"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">
                이메일
                <span className="text-xs text-slate-400 ml-2">(구글 로그인 연동에 사용됩니다)</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="구글 계정 이메일 입력"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">전화번호</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="전화번호 (선택)"
                className="bg-slate-700 border-slate-600 text-white"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300"
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? '수정 중...' : '저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
