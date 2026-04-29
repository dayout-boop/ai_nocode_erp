import ERPLayout from "@/components/ERPLayout";

const DEV_DASHBOARD_URL = "https://dogolf-dash-mjywck97.manus.space/";

export default function DevDashboard() {
  return (
    <ERPLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">개발 대시보드</h1>
            <p className="text-xs text-gray-500">두골프 개발 현황 및 배포 상태를 확인합니다.</p>
          </div>
          <a
            href={DEV_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
          >
            새 탭에서 열기 ↗
          </a>
        </div>
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          <iframe
            src={DEV_DASHBOARD_URL}
            className="w-full h-full"
            title="개발 대시보드"
            allow="fullscreen"
          />
        </div>
      </div>
    </ERPLayout>
  );
}
