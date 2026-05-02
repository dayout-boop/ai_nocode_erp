import re

content = open('/home/ubuntu/dogolf/client/src/pages/erp/SystemSettings.tsx').read()

# e.message 를 안전하게 수정 (e: unknown 타입에서)
# 패턴: onError: (e: unknown) => toast.error(`...${e.message}...`)
# 변경: e.message -> e instanceof Error ? e.message : String(e)
content = content.replace(
    '`추가 실패: ${e.message}`',
    '`추가 실패: ${e instanceof Error ? e.message : String(e)}`'
)
content = content.replace(
    '`수정 실패: ${e.message}`',
    '`수정 실패: ${e instanceof Error ? e.message : String(e)}`'
)
content = content.replace(
    '`삭제 실패: ${e.message}`',
    '`삭제 실패: ${e instanceof Error ? e.message : String(e)}`'
)
content = content.replace(
    '`기본값 설정 실패: ${e.message}`',
    '`기본값 설정 실패: ${e instanceof Error ? e.message : String(e)}`'
)
content = content.replace(
    '`키워드 저장 실패: ${e.message}`',
    '`키워드 저장 실패: ${e instanceof Error ? e.message : String(e)}`'
)
# 혹시 남은 e.message 패턴 처리
content = re.sub(
    r'\$\{e\.message\}',
    '${e instanceof Error ? e.message : String(e)}',
    content
)

open('/home/ubuntu/dogolf/client/src/pages/erp/SystemSettings.tsx', 'w').write(content)
print('완료')
