with open('/home/ubuntu/dogolf/client/src/pages/erp/SystemSettings.tsx', 'r') as f:
    content = f.read()

old_export = 'export default function SystemSettings() {'
new_component = '''// ─── 자동 완료 키워드 튜닝 섹션 ─────────────────────────────────────────────
function CompletionKeywordsSection() {
  const { data, isLoading, refetch } = trpc.systemSettings.getCompletionKeywords.useQuery();
  const updateMutation = trpc.systemSettings.updateCompletionKeywords.useMutation({
    onSuccess: () => {
      toast.success("키워드가 저장되었습니다");
      refetch();
      setEditMode(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const resetMutation = trpc.systemSettings.resetCompletionKeywords.useMutation({
    onSuccess: (res) => {
      toast.success("기본값으로 초기화되었습니다");
      setKeywords(res.keywords);
      refetch();
      setEditMode(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const [editMode, setEditMode] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  const currentKeywords = data?.keywords ?? [];

  const handleEdit = () => {
    setKeywords([...currentKeywords]);
    setEditMode(true);
  };

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      toast.warning("이미 등록된 키워드입니다");
      return;
    }
    setKeywords([...keywords, trimmed]);
    setNewKeyword("");
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleSave = () => {
    if (keywords.length === 0) {
      toast.warning("키워드를 최소 1개 이상 등록해야 합니다");
      return;
    }
    updateMutation.mutate({ keywords });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <KeyRound size={15} className="text-amber-600" />
            자동 완료 감지 키워드
            {data?.isCustom && (
              <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                커스텀
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {!editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={handleEdit} className="h-7 text-xs gap-1">
                  <Edit2 size={11} /> 편집
                </Button>
                {data?.isCustom && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetMutation.mutate()}
                    disabled={resetMutation.isPending}
                    className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <RotateCcw size={11} /> 초기화
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {updateMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  저장
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditMode(false)}
                  className="h-7 text-xs gap-1"
                >
                  <X size={11} /> 취소
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Manus AI 응답에 아래 키워드가 포함되면 해당 개발 요청이 자동으로 <strong>완료</strong> 처리됩니다.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 size={14} className="animate-spin" />
            키워드 로딩 중...
          </div>
        ) : editMode ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                placeholder="새 키워드 입력 후 Enter"
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={handleAddKeyword} className="h-8 text-xs shrink-0">
                <Plus size={12} /> 추가
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-full"
                >
                  {kw}
                  <button
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-amber-400 hover:text-red-500 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">총 {keywords.length}개 키워드</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {currentKeywords.map((kw) => (
              <span
                key={kw}
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemSettings() {'''

if old_export in content:
    content = content.replace(old_export, new_component, 1)
    with open('/home/ubuntu/dogolf/client/src/pages/erp/SystemSettings.tsx', 'w') as f:
        f.write(content)
    print('완료')
else:
    print('패턴 없음')
