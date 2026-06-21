#!/usr/bin/env python3
"""
resolver.py — 사용자별 "여러 방식" 해석기 (제품1 글로벌 실사용 전제)
===================================================================
제품1 실사용: 글로벌 사용자 N명이 동시에 각자 다른 방식을 쓴다.
엔진은 owner_key별로 "이 사용자는 어떤 키/연결/에이전트/과금 방식인가"를
해석(resolve)해서 오케스트레이션한다. 단편 호출이 아니라 사용자 맥락 위에서.

소급 불가 구조 전제 (지금 박음, 실제 구현은 제품 단계):
  1. KeySource    — BYOK(고객 키) vs 우리 키(크레딧 대행) 분기
  2. ConnectMethod — OAuth/MCP/iframe/headless 폴백 체인 (제품1 §7.0)
  3. AgentRouter  — 작업→에이전트 자동 선택 (arch-core)
  4. CreditGate   — BYOK=무차감 / 크레딧=잔액확인·차감 (정본 §6.2)
  5. 호출값 자동 세팅 — 사람이 arch-core 손수정 X, 코드가 호출값 구성

★ 핵심: agents.py가 "우리 키"를 직접 읽지 않는다.
  resolver가 owner_key로 "이 사용자의 키/방식"을 해석해 agents에 주입.
  → 같은 코드가 고객A(BYOK)·고객B(크레딧)를 동시에 다르게 처리.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


# ── 1. 키 소스 (BYOK vs 우리 키 대행) — 제품1 §81 ────────
@dataclass
class KeyResolution:
    """사용자가 어떤 키로 호출하는가."""
    source: str            # "byok"(고객 키) | "managed"(우리 키+크레딧 대행)
    api_key: str           # 실제 키값 (BYOK=고객 키, managed=우리 키)
    bill_credits: bool     # True=크레딧 차감(managed), False=무차감(BYOK)


class KeySourceResolver:
    """owner_key + provider로 사용할 키를 해석.
    - BYOK: 고객이 맡긴 키(시크릿 매니저에서) → 차감 없음
    - managed: 우리 키(환경변수) → 크레딧 차감
    지금은 환경변수 기반(단일), 제품 단계서 시크릿매니저+고객설정 연동."""

    def resolve(self, owner_key: str, provider: str, key_env: str) -> KeyResolution:
        # 제품 단계: 고객 설정(DB)에서 "이 사용자가 BYOK인가" 조회.
        # 지금(전제): 환경변수 ENGINE_KEY_MODE로 시뮬레이션.
        mode = os.environ.get("ENGINE_KEY_MODE", "managed")  # 기본=우리 대행
        if mode == "byok":
            # 제품: 시크릿매니저에서 owner_key의 고객 키 복호화
            customer_key = os.environ.get(f"BYOK_{provider.upper()}_{_safe(owner_key)}")
            if customer_key:
                return KeyResolution("byok", customer_key, bill_credits=False)
        # managed: 우리 키 + 크레딧 차감
        our_key = os.environ.get(key_env, "")
        return KeyResolution("managed", our_key, bill_credits=True)


# ── 2. 연결 방식 폴백 체인 — 제품1 §7.0 ─────────────────
class ConnectMethodResolver:
    """연결 대상 서비스 → 되는 방식 자동 선택 (제품1 폴백 체인).
    지금은 선언만(엔진 단계엔 LLM 호출이라 연결 불필요).
    제품 런타임에서 실제 OAuth/MCP/iframe/headless 구동."""
    CHAIN = ["oauth", "mcp", "iframe", "headless", "we_provision"]

    def resolve(self, service: str) -> str:
        # 제품 단계: 서비스별 매트릭스(커넥터 등재 정보)로 결정.
        # 지금(전제): 폴백 체인 순서만 반환.
        return "declared_only(엔진단계: LLM직접호출, 연결 폴백은 제품런타임)"


# ── 2b. Late Binding 런타임 등급 (C-7 최종 정본 — 가변 스위칭) ──
# ★ 실행 시점에 태스크 용량을 판정 → micro(휘발성 컨테이너) vs heavy(독립 VM)
#   부품을 동적으로 갈아 끼움. 작은 건 micro(싸고 빠름), 비대하면 heavy(고사양).
#   단일 등급이면 못 챙김: micro만=큰 작업 실패 / heavy만=작은 작업 비용낭비.
@dataclass
class RuntimeTier:
    tier: str           # "micro" | "heavy"
    provider_hint: str  # 어느 SandboxProvider 등급
    reason: str = ""


class RuntimeTierResolver:
    """SandboxProvider가 실행 시점에 태스크 용량을 판정해 micro/heavy 동적 선택.
    엔진 단계: 판정 로직만 (실제 VM 기동은 제품 런타임·벤더 어댑터)."""
    # 임계는 dayout 수치 결정 — 여기선 구조·기본값만
    HEAVY_TRIGGERS = ("build", "scan", "container", "compile_large", "vm")

    def resolve(self, task_kind: str, est_payload_mb: float = 0.0,
                est_cpu_heavy: bool = False) -> RuntimeTier:
        # 비대 판정: 무거운 작업 종류이거나, 페이로드/CPU가 임계 초과
        heavy = (task_kind in self.HEAVY_TRIGGERS
                 or est_payload_mb >= 50.0   # 임계 예시 (dayout 확정)
                 or est_cpu_heavy)
        if heavy:
            return RuntimeTier("heavy", "sandbox_heavy_vm",
                               f"비대 태스크({task_kind}) → 고사양 독립 VM")
        return RuntimeTier("micro", "sandbox_micro_container",
                           f"경량 태스크({task_kind}) → 휘발성 컨테이너")


# ── 2c. Git 인프라 이원화 (C-7 최종 정본 — 물리통제 유무) ──
# ★ 물리제어 가능선(내부): G5 격리=Gitea, 비대 빌드/스캔=GitLab CE 동적 가동
#   물리제어 불가선(외부): G1 우리개발·G4 고객연결=GitHub/GitLab Cloud API
#     단 Rate Limit 방어 위해 Temporal 비동기 큐 완충 강제.
@dataclass
class GitRoute:
    role: str           # G1~G5
    backend: str        # "gitea" | "gitlab_ce" | "external_api"
    physical_control: bool
    async_buffer: bool  # Temporal 큐 완충 필요?
    reason: str = ""


class GitInfraResolver:
    """Git 5역할을 물리통제 유무로 이원화 라우팅 (C-7 최종)."""
    def resolve(self, role: str, heavy_pipeline: bool = False) -> GitRoute:
        if role in ("G2", "G5"):
            # 물리제어 가능선 (내부): 격리는 Gitea, 비대 빌드는 GitLab CE 동적
            if heavy_pipeline:
                return GitRoute(role, "gitlab_ce", True, False,
                                "비대 빌드/스캔 → GitLab CE 동적 가동")
            return GitRoute(role, "gitea", True, False,
                            "내부 격리·자산 보관 → 경량 Gitea/Forgejo")
        # 물리제어 불가선 (외부): G1 우리개발·G4 고객연결 = 외부 상용 API
        return GitRoute(role, "external_api", False, True,
                        "외부 상용(GitHub/GitLab Cloud) → Temporal 큐 완충 강제")


# ── 2d. LLM 4축 분산 (★arch-core llm_distribution 구현 — 획일화 해제) ──
# 언어→LLM 1:1 고정 폐기. 능력 매트릭스 풀 + 리전 폴백 + 동적 라우팅.
@dataclass
class LLMChoice:
    agent: str
    region: str
    reason: str = ""
    fallbacks: list = field(default_factory=list)


class RegionResolver:
    """축3: 리전 가용·가격·성능·규제 → 우수 리전 선택, 과부하 시 폴백.
    엔진 단계: 판정 로직만 (region_health 실측은 제품 런타임·Neon)."""
    def __init__(self, arch_core: dict):
        ra = arch_core.get("llm_distribution", {}).get("region_aware", {})
        self.regions_hint = ra.get("regions", "")
        # region_health는 제품서 Neon 조회. 엔진선 기본 우선순위만.
        self.default_order = ["ap-northeast", "us-east", "eu-west", "us-west", "ap-south"]

    def best(self, sovereignty: str = "", unavailable: list = None) -> str:
        unavailable = unavailable or []
        # 규제 핀 (EU→EU 강제)
        if sovereignty == "eu":
            return "eu-west"
        # 가용 + 우선순위 (과부하 리전 제외)
        for r in self.default_order:
            if r not in unavailable:
                return r
        return self.default_order[0]

    def failover(self, current: str, all_unavailable: list) -> Optional[str]:
        """과부하·429·503 → 다음 우수 리전 (없으면 None=LLM 폴백으로)."""
        for r in self.default_order:
            if r != current and r not in all_unavailable:
                return r
        return None


class LanguageMatrixRouter:
    """축1·2·4: 언어별 능력 풀에서 (가용 LLM × 우수 리전) 동적 선택.
    arch-core language_matrix 읽음. 새 언어=매트릭스 행, 새 LLM=풀 항목 (코드 0)."""
    def __init__(self, arch_core: dict):
        ld = arch_core.get("llm_distribution", {})
        self.matrix = ld.get("language_matrix", {})
        self.region = RegionResolver(arch_core)
        self.agents = arch_core.get("agents", {})

    def _pool_for(self, language: str) -> list:
        # 언어별 풀 (매트릭스 문자열에서 에이전트명 추출, 없으면 '*' 기본)
        raw = self.matrix.get(language) or self.matrix.get("*") or ""
        names = [a.strip() for a in str(raw).replace("[", "").replace("]", "")
                 .split("]")[0].split(",") if a.strip() and a.strip() in self.agents]
        # 매트릭스 파싱 실패 시 전체 에이전트 폴백 (열려있음)
        return names or list(self.agents.keys())

    def pick(self, language: str, sovereignty: str = "",
             unavailable_llm: list = None, unavailable_region: list = None) -> LLMChoice:
        """언어 ∩ 가용 LLM ∩ 우수 리전 → 최적 + 폴백 체인."""
    def pick(self, language: str, sovereignty: str = "",
             unavailable_llm: list = None, unavailable_region: list = None,
             weekly_rank: list = None, shutdown: set = None) -> LLMChoice:
        """언어 ∩ 가용 LLM ∩ 우수 리전 → 최적 + 폴백 체인.
        weekly_rank: evaluator가 준 주단위 1~3위 [(agent,score)…] (있으면 우선).
        shutdown: 서비스 종료 즉시 제외 집합 (즉시층)."""
        unavailable_llm = list(unavailable_llm or [])
        shutdown = shutdown or set()
        # ★즉시층: 종료된 것은 즉시 제외 (주 안 기다림)
        unavailable_llm += [a for a in shutdown if a not in unavailable_llm]
        # 풀 결정: 주단위 순위(고정층) 있으면 그 순서, 없으면 매트릭스
        if weekly_rank:
            pool = [a for a, _ in weekly_rank if a not in unavailable_llm]
        else:
            pool = [a for a in self._pool_for(language) if a not in unavailable_llm]
        if not pool:
            return LLMChoice("", "", "가용 LLM 없음 → 에스컬레이션", [])
        region = self.region.best(sovereignty, unavailable_region or [])
        # 폴백 체인: ①같은 LLM 다른 리전(우선) → ②다음 LLM(2·3위)
        fb = [f"{pool[0]}@{r}" for r in self.region.default_order if r != region][:2]
        fb += [f"{a}@{region}" for a in pool[1:]]
        src = "주단위 순위" if weekly_rank else "매트릭스"
        return LLMChoice(pool[0], region,
                         f"언어={language} 풀={pool} 리전={region} ({src})", fb)


# ── 3. 에이전트 라우팅 (arch-core 기반) ─────────────────
class AgentRouter:
    """작업(평면/난이도) → 에이전트 자동 선택. arch-core가 단일 진실."""
    def __init__(self, arch_core: dict):
        self.agents = arch_core.get("agents", {})
        self.planes = arch_core.get("planes", {})
        self.routing = arch_core.get("routing_by_difficulty", {})

    def by_plane(self, plane: str) -> Optional[str]:
        p = self.planes.get(plane)
        return p.get("agent") if p else None

    def by_difficulty(self, level: str):
        return self.routing.get(level, [])


# ── 4. 크레딧 게이트 — 정본 §6.2 (3분리) ────────────────
# ★ 핵심: 비용은 3종류. 고객이 LLM/인프라를 직접 연결(BYOK)해도
#   "플랫폼 사용료"(우리 오케스트레이션·기획서·검증)는 항상 크레딧 차감.
#   (Traycer 모델: LLM은 네 구독, Traycer 기능은 Traycer 요금)
@dataclass
class CreditResult:
    allowed: bool
    reason: str = ""


@dataclass
class CostBreakdown:
    """한 작업의 3종 비용. owner_key별 과금 명세."""
    llm_credits: int = 0        # LLM 호출 (BYOK=0, managed=재청구)
    platform_credits: int = 0   # 우리 오케스트레이션·기획·검증 (항상 차감)
    infra_credits: int = 0      # 우리 샌드박스·브라우저 (우리 제공분만)
    note: str = ""

    @property
    def total(self) -> int:
        return self.llm_credits + self.platform_credits + self.infra_credits


class CreditGate:
    """비용 3분리. 정본 ⑦ 4계층 크레딧 + 제품1 §81 BYOK/managed 선택.

    1. LLM 비용     : BYOK(고객키)=무차감 / managed(우리키 재청구)=차감
    2. 플랫폼 사용료: 항상 차감 (BYOK여도! 우리 오케스트레이션·기획·검증 가치)
    3. 인프라 사용료: 우리 제공 인프라(샌드박스·브라우저)만 차감

    ★ 법적: managed LLM = 우리 API키 재청구(wrapper, 합법).
       고객 구독(ChatGPT Plus/Claude Max) 대행은 금지(약관) → API키만 BYOK 허용.
    지금은 구조+참조단가, 제품서 원장 DB·실제 차감 연동."""

    # 참조 단가 (정본 §6.3 인스턴스 파라미터 — dayout 유보, 여기 기본값)
    PLATFORM_FEE_PER_TASK = int(os.environ.get("PLATFORM_CREDITS_PER_TASK", "1"))
    TOKENS_PER_CREDIT = int(os.environ.get("TOKENS_PER_CREDIT", "10000"))

    def precheck(self, owner_key: str, key_res: KeyResolution) -> CreditResult:
        # 제품: 원장 DB에서 (플랫폼+예상 LLM+인프라) 잔액 확인, 0이면 차단.
        # 지금(전제): 통과. 단 플랫폼 사용료는 BYOK여도 청구됨을 명시.
        if key_res.source == "byok":
            return CreditResult(True, "BYOK LLM=무차감 / 단 플랫폼 사용료는 크레딧 차감")
        return CreditResult(True, "managed: LLM 재청구 + 플랫폼 사용료 차감")

    def estimate(self, owner_key: str, key_res: KeyResolution,
                 tokens_in: int = 0, tokens_out: int = 0,
                 used_our_infra: bool = False) -> CostBreakdown:
        """3종 비용 산정. agents 호출 후 실제 토큰으로 호출."""
        import math
        cb = CostBreakdown()
        # 1. LLM: BYOK면 0(고객 키로 직접), managed면 재청구
        if key_res.bill_credits and (tokens_in or tokens_out):
            cb.llm_credits = max(1, math.ceil((tokens_in + tokens_out) / self.TOKENS_PER_CREDIT))
        # 2. 플랫폼 사용료: 항상 (BYOK여도 — 우리 서비스 가치)
        cb.platform_credits = self.PLATFORM_FEE_PER_TASK
        # 3. 인프라: 우리 샌드박스/브라우저 썼을 때만
        if used_our_infra:
            cb.infra_credits = 1  # 참조값, 제품서 실제 사용량
        cb.note = f"source={key_res.source}"
        return cb

    def charge(self, owner_key: str, breakdown: CostBreakdown):
        # 제품: 불변 원장에 3종 명세 적재 + 차감. ⑧ 대량소비 탐지 신호원.
        # 지금(전제): 구조만.
        pass


# ── 5. 통합 호출 컨텍스트 (owner_key별 "여러 방식" 묶음) ──
@dataclass
class CallContext:
    """한 사용자의 한 호출에 필요한 모든 방식 해석 결과.
    agents.py는 이걸 받아 호출 — '우리 키'를 직접 안 읽음."""
    owner_key: str
    provider: str
    key: KeyResolution
    credit: CreditResult
    model: str
    api_base: str = ""
    extra: dict = field(default_factory=dict)


def _safe(s: str) -> str:
    return s.replace(":", "_").replace("/", "_")


# ── Resolver 묶음 (제품1 글로벌 실사용 진입점) ───────────
class ProductResolver:
    """글로벌 사용자 N명을 owner_key별로 '여러 방식' 해석.
    엔진 오케스트레이터가 호출 전 이걸로 컨텍스트를 만든다."""
    def __init__(self, arch_core: dict):
        self.keys = KeySourceResolver()
        self.connect = ConnectMethodResolver()
        self.router = AgentRouter(arch_core)
        self.credit = CreditGate()
        self.agents_cfg = arch_core.get("agents", {})

    def build_context(self, owner_key: str, agent_name: str) -> CallContext:
        cfg = self.agents_cfg.get(agent_name, {})
        provider = cfg.get("provider", agent_name)
        key_env = cfg.get("key_env", "")
        key_res = self.keys.resolve(owner_key, provider, key_env)
        credit_res = self.credit.precheck(owner_key, key_res)
        return CallContext(
            owner_key=owner_key, provider=provider, key=key_res,
            credit=credit_res, model=cfg.get("model", ""),
            api_base=cfg.get("api_base", ""),
            extra={"token_param": cfg.get("token_param", "max_tokens"),
                   "call_kind": cfg.get("call_kind", "openai_compatible")},
        )


if __name__ == "__main__":
    # 데모: 같은 코드가 owner별 다른 방식 처리
    # arch-core는 orchestrator의 캐시 로더 재사용 (일관성 — 매 읽기 병목 방지 사상)
    try:
        from orchestrator import load_arch_core
        core, _ = load_arch_core()
    except Exception:
        import yaml
        core = yaml.safe_load(open(os.path.join(os.path.dirname(__file__), "arch-core.yaml")))
    pr = ProductResolver(core)
    print("=== 제품1 글로벌 사용자 '여러 방식' + 비용 3분리 데모 ===")
    # 두 사용자: A=BYOK(자기 LLM키), B=managed(우리 키 대행)
    scenarios = [
        ("tenant_A:user_1:proj_x", "byok"),      # 고객 키 직접
        ("tenant_B:user_2:proj_y", "managed"),   # 우리 키 대행
    ]
    for owner, mode in scenarios:
        os.environ["ENGINE_KEY_MODE"] = mode
        if mode == "byok":
            # 데모: 고객이 자기 키를 맡긴 상황 시뮬 (제품선 시크릿매니저)
            os.environ[f"BYOK_CODEX_{owner.replace(':','_').replace('/','_')}"] = "sk-customer-demo"
        ctx = pr.build_context(owner, "codex_rust")
        # 가상 토큰으로 비용 산정 (실제론 agents 호출 후)
        cb = pr.credit.estimate(owner, ctx.key, tokens_in=2000, tokens_out=3000,
                                used_our_infra=True)
        print(f"\nowner={owner}  [{mode}]")
        print(f"  provider={ctx.provider} model={ctx.model}")
        print(f"  key.source={ctx.key.source}")
        print(f"  비용 3분리: LLM={cb.llm_credits} 플랫폼={cb.platform_credits} "
              f"인프라={cb.infra_credits} → 합계 {cb.total} 크레딧")
        if ctx.key.source == "byok":
            print(f"    → LLM은 고객 키(무차감), 단 플랫폼 사용료는 차감 ✅")
        else:
            print(f"    → LLM 재청구 + 플랫폼 + 인프라 모두 차감 ✅")
