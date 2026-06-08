/**
 * 파트너 등록증 인증 게이트 페이지
 * - 온보딩 완료 후 등록증 미제출 파트너가 ERP 진입 전 거치는 페이지
 * - 사업자등록증 / 관광사업자등록증 업로드 → OCR 자동 인식 → 자동승인 → ERP 진입
 * - 관리자가 직접 생성한 파트너 계정도 이 페이지에서 등록증 제출
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import {
  Upload,
  CheckCircle2,
  FileText,
  Loader2,
  ArrowRight,
  AlertCircle,
  Building2,
  MapPin,
  User,
  Shield,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// URL 파라미터 파싱 훅
function useUrlParams() {
  const [params, setParams] = useState<{ email?: string; name?: string }>({});
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({
      email: search.get("email") || undefined,
      name: search.get("name") || undefined,
    });
  }, []);
  return params;
}

// 파일 업로드 드롭존 컴포넌트
function UploadZone({
  label,
  icon,
  accept,
  onFile,
  uploaded,
  uploading,
  ocrData,
}: {
  label: string;
  icon: React.ReactNode;
  accept: string;
  onFile: (file: File) => void;
  uploaded: boolean;
  uploading: boolean;
  ocrData?: Record<string, string | null> | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div className="space-y-3">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-emerald-400 bg-emerald-500/10"
            : uploaded
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/8"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 size={32} className="text-emerald-400 animate-spin" />
          ) : uploaded ? (
            <CheckCircle2 size={32} className="text-emerald-400" />
          ) : (
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              {icon}
            </div>
          )}
          <div>
            <p className="text-white font-medium text-sm">
              {uploading ? "업로드 중..." : uploaded ? "업로드 완료" : label}
            </p>
            {!uploading && !uploaded && (
              <p className="text-white/40 text-xs mt-1">
                클릭하거나 파일을 드래그하세요 (JPG, PNG, PDF)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* OCR 결과 표시 */}
      {ocrData && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            OCR 인식 완료
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ocrData.companyName && (
              <div className="flex items-start gap-1.5">
                <Building2 size={12} className="text-white/40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white/40 text-xs">상호</p>
                  <p className="text-white text-xs font-medium">{ocrData.companyName}</p>
                </div>
              </div>
            )}
            {ocrData.ceoName && (
              <div className="flex items-start gap-1.5">
                <User size={12} className="text-white/40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white/40 text-xs">대표자</p>
                  <p className="text-white text-xs font-medium">{ocrData.ceoName}</p>
                </div>
              </div>
            )}
            {ocrData.businessNumber && (
              <div className="flex items-start gap-1.5">
                <FileText size={12} className="text-white/40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white/40 text-xs">사업자번호</p>
                  <p className="text-white text-xs font-medium">{ocrData.businessNumber}</p>
                </div>
              </div>
            )}
            {(ocrData.address || ocrData.licenseNo) && (
              <div className="flex items-start gap-1.5">
                <MapPin size={12} className="text-white/40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white/40 text-xs">{ocrData.licenseNo ? "등록번호" : "주소"}</p>
                  <p className="text-white text-xs font-medium truncate max-w-[120px]">
                    {ocrData.licenseNo ?? ocrData.address}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartnerPendingVerification() {
  const { email, name } = useUrlParams();

  // 업로드 상태
  const [bizUploading, setBizUploading] = useState(false);
  const [tourUploading, setTourUploading] = useState(false);
  const [bizKey, setBizKey] = useState<string | null>(null);
  const [bizUrl, setBizUrl] = useState<string | null>(null);
  const [tourKey, setTourKey] = useState<string | null>(null);
  const [tourUrl, setTourUrl] = useState<string | null>(null);
  const [bizOcr, setBizOcr] = useState<Record<string, string | null> | null>(null);
  const [tourOcr, setTourOcr] = useState<Record<string, string | null> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // tRPC mutations
  const ocrBiz = trpc.partnerOnboarding.ocrBusinessLicense.useMutation();
  const ocrTour = trpc.partnerOnboarding.ocrTourismLicense.useMutation();
  const submitMutation = trpc.partnerOnboarding.submitWithBothOcr.useMutation();

  // 자동 이동 카운트다운
  useEffect(() => {
    if (!approved) return;
    if (countdown <= 0) {
      window.location.href = "/partner/dashboard";
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [approved, countdown]);

  // 파일 업로드 공통 함수
  const uploadFile = async (file: File): Promise<{ key: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload/partner-license", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) throw new Error("업로드 실패");
    const data = await res.json() as { key: string; url: string };
    return data;
  };

  // 사업자등록증 업로드 + OCR
  const handleBizFile = async (file: File) => {
    setBizUploading(true);
    try {
      const { key, url } = await uploadFile(file);
      setBizKey(key);
      setBizUrl(url);

      // OCR 실행
      const ocrRes = await ocrBiz.mutateAsync({ imageUrl: url });
      if (ocrRes.success && ocrRes.data) {
        setBizOcr(ocrRes.data as Record<string, string | null>);
        toast.success(`사업자등록증 인식 완료 - 상호: ${ocrRes.data.companyName ?? "인식 중"}`);
      }
    } catch (err) {
      toast.error("업로드 실패: " + String(err));
    } finally {
      setBizUploading(false);
    }
  };

  // 관광사업자등록증 업로드 + OCR
  const handleTourFile = async (file: File) => {
    setTourUploading(true);
    try {
      const { key, url } = await uploadFile(file);
      setTourKey(key);
      setTourUrl(url);

      // OCR 실행
      const ocrRes = await ocrTour.mutateAsync({ imageUrl: url });
      if (ocrRes.success && ocrRes.data) {
        setTourOcr(ocrRes.data as Record<string, string | null>);
        toast.success(`관광사업자등록증 인식 완료 - 등록번호: ${ocrRes.data.licenseNo ?? "인식 중"}`);
      }
    } catch (err) {
      toast.error("업로드 실패: " + String(err));
    } finally {
      setTourUploading(false);
    }
  };

  // 최종 제출 (자동승인 트리거)
  const handleSubmit = async () => {
    if (!email) {
      toast.error("이메일 정보가 없습니다. 다시 로그인해주세요.");
      return;
    }
    if (!bizUrl && !tourUrl) {
      toast.error("최소 1개의 등록증을 업로드해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitMutation.mutateAsync({
        contactName: name ?? email.split("@")[0],
        contactEmail: email,
        businessLicenseKey: bizKey ?? undefined,
        businessLicenseUrl: bizUrl ?? undefined,
        ocrResult: bizOcr ? JSON.stringify(bizOcr) : undefined,
        tourismLicenseKey: tourKey ?? undefined,
        tourismLicenseUrl: tourUrl ?? undefined,
        tourismOcrResult: tourOcr ? JSON.stringify(tourOcr) : undefined,
        sampleCategory: "golf_tour_mixed",
        subscriptionPlan: "starter",
        billingCycle: "monthly",
      });

      if (res.autoApproved) {
        setApproved(true);
        toast.success("자동 승인 완료! 파트너 ERP로 이동합니다.");
        // 구글 재로그인으로 세션 갱신 (isActive=true 반영)
        setTimeout(() => {
          window.location.href = "/api/partner/auth/google?returnUrl=/partner/dashboard";
        }, 3000);
      } else {
        toast.success("신청 완료 - 관리자 검토 후 1~2 영업일 내 승인됩니다.");
      }
    } catch (err: any) {
      if (err?.message?.includes("이미 승인된")) {
        toast.success("이미 승인된 계정 - 파트너 대시보드로 이동합니다.");
        setTimeout(() => { window.location.href = "/partner/dashboard"; }, 1500);
      } else {
        toast.error("제출 실패: " + String(err?.message ?? err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 자동승인 완료 화면
  if (approved) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">인증 완료!</h1>
          <p className="text-white/60 text-sm mb-6">
            등록증 인증이 완료되었습니다.<br />
            파트너 ERP로 자동 이동합니다.
          </p>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
            <p className="text-emerald-400 text-sm font-medium">
              {countdown}초 후 자동 이동...
            </p>
          </div>
          <button
            onClick={() => { window.location.href = "/api/partner/auth/google?returnUrl=/partner/dashboard"; }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            지금 바로 이동
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
      {/* 배경 그라디언트 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/6 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/partner-landing">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TC</span>
            </div>
            <span className="text-white font-semibold text-sm">투어커뮤니케이션</span>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 text-white/40 text-xs">
          <Shield size={12} />
          <span>SSL 보안 연결</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* 타이틀 */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">사업자 인증</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              파트너 ERP 이용을 위해 사업자 정보를 인증해주세요.<br />
              등록증 업로드 즉시 자동 승인됩니다.
            </p>
            {email && (
              <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 mt-3">
                <span className="text-white/50 text-xs">{email}</span>
              </div>
            )}
          </div>

          {/* 안내 배너 */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-emerald-300 text-sm font-medium">즉시 자동 승인</p>
              <p className="text-white/50 text-xs mt-0.5">
                사업자등록증 + 관광사업자등록증 모두 업로드 시 즉시 자동 승인됩니다.
                1개만 업로드 시 관리자 검토 후 1~2 영업일 내 승인됩니다.
              </p>
            </div>
          </div>

          {/* 업로드 영역 */}
          <div className="space-y-4 mb-6">
            <UploadZone
              label="사업자등록증 업로드"
              icon={<Building2 size={22} className="text-white/60" />}
              accept="image/*,.pdf"
              onFile={handleBizFile}
              uploaded={!!bizUrl}
              uploading={bizUploading}
              ocrData={bizOcr}
            />
            <UploadZone
              label="관광사업자등록증 업로드 (선택)"
              icon={<MapPin size={22} className="text-white/60" />}
              accept="image/*,.pdf"
              onFile={handleTourFile}
              uploaded={!!tourUrl}
              uploading={tourUploading}
              ocrData={tourOcr}
            />
          </div>

          {/* 등록증 없음 안내 */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-medium">등록증이 없으신가요?</p>
              <p className="text-white/50 text-xs mt-0.5">
                관광사업자 등록이 진행 중이신 경우, 사업자등록증만 업로드하셔도 신청 가능합니다.
                관리자가 검토 후 승인해드립니다.
              </p>
            </div>
          </div>

          {/* 제출 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (!bizUrl && !tourUrl)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                인증 완료 및 ERP 시작
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* 나중에 하기 */}
          <div className="text-center mt-4">
            <Link href="/partner/login">
              <span className="text-white/30 text-xs hover:text-white/50 cursor-pointer transition-colors">
                나중에 인증하기 (관리자 검토 대기)
              </span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
